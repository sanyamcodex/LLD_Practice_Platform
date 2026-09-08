import { describe, it, expect } from 'vitest';
import { DeterministicEvaluator } from '../../backend/src/domain/evaluation/DeterministicEvaluator';
import { STANDARD_LLD_RUBRIC } from '../../backend/src/domain/evaluation/rubric';
import { Problem } from '../../backend/src/domain/entities/Problem';
import { Submission } from '../../backend/src/domain/entities/Submission';

describe('DeterministicEvaluator', () => {
  const evaluator = new DeterministicEvaluator();

  const mockProblem: Problem = {
    id: 'prob-1',
    title: 'Design a Parking Lot',
    difficulty: 'MEDIUM',
    description: 'Design an automated parking lot with multi-floor capacity and ticket management.',
    futureRequirements: [
      'Add VIP reserved parking spots with dynamic surge pricing during peak hours',
    ],
  };

  it('evaluates an empty or sparse submission and flags structural deficiencies', async () => {
    const emptySubmission: Submission = {
      id: 'sub-empty',
      attemptId: 'att-1',
      status: 'SUBMITTED',
      contentSnapshot: {
        assumptions: '',
        classesAndResponsibilities: '',
        relationships: '',
        extensibilityAnswer: '',
      },
      createdAt: new Date().toISOString(),
    };

    const evaluation = await evaluator.evaluate(emptySubmission, mockProblem, STANDARD_LLD_RUBRIC);

    expect(evaluation.evaluatorType).toBe('DETERMINISTIC');
    expect(evaluation.rubricResults.length).toBe(7);

    // Should flag missing assumptions
    const reqResult = evaluation.rubricResults.find((r) => r.criterionKey === 'requirement_understanding');
    expect(reqResult?.score).toBeLessThanOrEqual(2);
    expect(reqResult?.concern).toContain('Assumptions are either absent');

    // Should flag lack of classes
    const classResult = evaluation.rubricResults.find((r) => r.criterionKey === 'class_responsibilities');
    expect(classResult?.score).toBe(1);
    expect(classResult?.concern).toContain('No distinct classes');

    // Should flag blank extensibility
    const extResult = evaluation.rubricResults.find((r) => r.criterionKey === 'extensibility');
    expect(extResult?.score).toBe(1);
    expect(extResult?.concern).toContain('Extensibility question was left blank');
  });

  it('correctly evaluates a rich, well-formed object-oriented design submission', async () => {
    const richSubmission: Submission = {
      id: 'sub-rich',
      attemptId: 'att-2',
      status: 'SUBMITTED',
      contentSnapshot: {
        assumptions:
          'Assuming 4 floors, 500 total spots, 95% regular spots and 5% EV charging stations. Peak entry rate of 10 cars per minute.',
        classesAndResponsibilities: `
          interface ParkingStrategy { allocate(vehicle: Vehicle): ParkingSpot; }
          class NearestSpotStrategy implements ParkingStrategy { allocate() {} }
          class ParkingLot { - floors: List<ParkingFloor>; + parkVehicle(); + unparkVehicle(); }
          class ParkingFloor { - floorNumber: int; - spots: List<ParkingSpot>; }
          abstract class ParkingSpot { - id: String; - isFree: boolean; }
          class CompactSpot extends ParkingSpot {}
          class LargeSpot extends ParkingSpot {}
          class EVChargingSpot extends ParkingSpot { - chargerWattage: double; }
          class Ticket { - ticketId: String; - entryTime: Date; - spotId: String; }
          class PaymentProcessor { + calculateFee(ticket: Ticket): double; }
        `,
        relationships:
          'ParkingLot composition has-a ParkingFloor (1:N). ParkingFloor has-a ParkingSpot (1:N). CompactSpot, LargeSpot, and EVChargingSpot is-a inheritance from ParkingSpot. ParkingLot uses-a ParkingStrategy interface.',
        extensibilityAnswer:
          'To support VIP reserved spots with dynamic surge pricing, we introduce a VIPSpot subclass and plug in a SurgeFeeStrategy implementing the FeeCalculationStrategy interface without modifying the core ParkingLot or Ticket classes (Open-Closed Principle).',
      },
      createdAt: new Date().toISOString(),
    };

    const evaluation = await evaluator.evaluate(richSubmission, mockProblem, STANDARD_LLD_RUBRIC);

    expect(evaluation.evaluatorType).toBe('DETERMINISTIC');
    expect(evaluation.rubricResults.length).toBe(7);

    // Class extraction check
    const classResult = evaluation.rubricResults.find((r) => r.criterionKey === 'class_responsibilities');
    expect(classResult?.score).toBeGreaterThanOrEqual(4);
    expect(classResult?.evidence).toContain('ParkingLot');

    // Pattern check
    const patternResult = evaluation.rubricResults.find((r) => r.criterionKey === 'abstraction_pattern_use');
    expect(patternResult?.score).toBeGreaterThanOrEqual(4);
    expect(patternResult?.evidence).toContain('strategy');

    // Extensibility check
    const extResult = evaluation.rubricResults.find((r) => r.criterionKey === 'extensibility');
    expect(extResult?.score).toBeGreaterThanOrEqual(4);
    expect(extResult?.evidence).toContain('SurgeFeeStrategy');
  });
});
