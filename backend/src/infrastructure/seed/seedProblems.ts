import { Problem } from '../../domain/entities/Problem';
import { ProblemRepository } from '../../domain/ports/ProblemRepository';

export const SEEDED_PROBLEMS: Problem[] = [
  {
    id: 'prob-parking-lot',
    title: 'Design a Multi-Floor Parking Lot',
    difficulty: 'MEDIUM',
    description: `Design an automated parking lot management system for a multi-story commercial complex.

### Functional Requirements:
1. Support multiple floors, each with designated spot types: Compact, Large, Handicapped, and Electric Vehicle (EV) charging spots.
2. Support distinct vehicle types (Motorcycle, Car, Van, Bus, Truck, EV) with physical dimension mapping (e.g. Bus requires multiple consecutive Large spots or designated oversized bay).
3. Automated entry ticketing: Assign optimal available spot nearest to the entrance gate using a dynamic allocation policy.
4. Real-time display boards at each floor entrance showing remaining capacity per spot type.
5. Exit processing and fee calculation based on parking duration, vehicle type, and optional premium EV charging services.
6. Support multiple payment modes (Cash, Credit Card, UPI, Mobile Wallet).

### Concurrency & Non-Functional Requirements:
- Prevent race conditions when two vehicles attempt to claim the last available spot simultaneously.
- Clean object-oriented model separating domain entities, allocation algorithms, and payment processors.`,
    futureRequirements: [
      'Change Test A: Add VIP / Reserved corporate parking spots with priority reservation, dynamic surge pricing during peak hours, and penalty rates for unauthorized overstay.',
      'Change Test B: Support license plate recognition (ANPR) cameras that eliminate physical paper tickets and automatically invoice registered accounts upon exit.',
    ],
  },
  {
    id: 'prob-elevator-system',
    title: 'Design an Intelligent Elevator System',
    difficulty: 'HARD',
    description: `Design a centralized dispatching controller for a bank of 6 high-speed elevators in a 40-floor commercial skyscraper.

### Functional Requirements:
1. Elevators have states: IDLE, MOVING_UP, MOVING_DOWN, MAINTENANCE.
2. Elevators have physical capacities (weight limit and maximum passengers) and door safety sensor interlocks.
3. External Hall Calls: Passengers press Up or Down buttons on any floor.
4. Internal Car Calls: Passengers inside an elevator car select their destination floors.
5. Dispatching Algorithm: Central controller dispatches the most optimal elevator car to minimize passenger wait time and energy consumption (e.g., SCAN, LOOK, or destination dispatching).
6. Emergency handling: Fire alarms immediately lock elevators to ground floor with doors held open; seismic sensors halt cars at nearest floor.

### Constraints:
- Fast scheduling response (< 100ms calculation).
- Graceful degradation if 1 or 2 cars undergo maintenance.`,
    futureRequirements: [
      'Change Test A: Implement Destination Dispatching where passengers input their destination floor at a kiosk outside the elevator lobby before boarding, and the system groups passengers going to proximate floors.',
      'Change Test B: Implement Peak-Hour Zone Partitioning (e.g. Elevators 1-2 serve floors 1-15, Elevators 3-4 serve 16-30, Elevators 5-6 serve 31-40 express).',
    ],
  },
  {
    id: 'prob-vending-machine',
    title: 'Design a State-Driven Vending Machine',
    difficulty: 'EASY',
    description: `Design a standalone automated vending machine serving snacks and cold beverages.

### Functional Requirements:
1. Inventory Management: Machine holds items across multiple slots (aisles), each with rack capacity, item code, price, and stock count.
2. Lifecycle States: Machine operates through distinct states (NoCoinInserted, HasCoin/MoneyAccumulated, ProductSelected, DispensingProduct, RefundingChange).
3. Transaction flow:
   - User inserts coins/notes (accepted denominations: $1, $2, $5, $10).
   - User selects an item by slot code.
   - Machine checks price vs accumulated balance, validates stock availability.
   - If balance sufficient, dispenses item and computes exact change.
   - If user cancels transaction, returns all inserted money.
4. Maintenance / Admin mode: Operator can restock inventory, extract collected cash, and update item prices.

### Constraints:
- Prevent illegal state transitions (e.g. cannot dispense item before payment; cannot refund after item has dispensed).`,
    futureRequirements: [
      'Change Test A: Add contactless NFC card and QR code payments with external payment gateway integration and transaction authorization timeouts.',
      'Change Test B: Support combo deals and dynamic multi-item basket purchases with discount coupon redemption.',
    ],
  },
  {
    id: 'prob-library-management',
    title: 'Design a University Library Management System',
    difficulty: 'MEDIUM',
    description: `Design a digital catalog and lending management system for a university library with over 100,000 titles and physical assets.

### Functional Requirements:
1. Book item modeling: Distinguish between Book (abstract title, author, ISBN, subject) and BookItem (physical copy with barcode, rack location, condition status: AVAILABLE, RESERVED, LOANED, LOST).
2. Member types: Student (max 5 books, 14-day checkout) vs Faculty (max 15 books, 60-day checkout).
3. Search and Discovery: Support multi-criteria searching by Title, Author, Subject, Publication Date, and ISBN.
4. Lending & Circulation:
   - Checkout book copy with automatic due date computation.
   - Return processing with automated fine calculation ($0.50/day overdue).
   - Book reservation queue when all physical copies are on loan.
   - Renewals allowed once if no other member has placed a reservation hold.
5. Notification service: Send email/SMS alerts for upcoming due dates, overdue fines, and reservation arrival.`,
    futureRequirements: [
      'Change Test A: Support Digital E-Books and Audiobooks with concurrent lending limits, digital rights management (DRM) download tokens, and auto-return on expiration.',
      'Change Test B: Integrate Inter-Library Loan (ILL) protocol to borrow books from partner universities when out of local stock.',
    ],
  },
  {
    id: 'prob-splitwise-expense',
    title: 'Design an Expense Sharing System (Splitwise)',
    difficulty: 'HARD',
    description: `Design a collaborative expense sharing and debt simplification engine for groups and individuals.

### Functional Requirements:
1. User and Group Management: Users can create private groups, invite members, and track non-group direct 1:1 balances.
2. Add Expense: Support multiple expense split modes:
   - EQUAL: Split evenly among participants (handle odd penny rounding cleanly).
   - EXACT: Explicit monetary amounts specified per user (must sum to total expense).
   - PERCENTAGE: Percentage distribution per user (must sum to 100%).
   - SHARES: Relative proportion distribution (e.g. 2 shares vs 1 share).
3. Balance Sheet & Ledger: For any user, view net balance across all friends and specific group balance sheets.
4. Debt Simplification (Minimizing Cash Flow Transactions):
   - Given a network of directed debts (e.g., A owes B $10, B owes C $10), automatically compute the minimal number of settlement transactions (A pays C $10).
5. Settle Up: Record direct payments between two users to reconcile balances.`,
    futureRequirements: [
      'Change Test A: Multi-Currency support with dynamic foreign exchange rate conversion at the timestamp of the expense and currency-hedged settlement.',
      'Change Test B: Recurring monthly subscriptions with automated itemized pro-rata splitting and automated payment reminder webhooks.',
    ],
  },
];

export async function seedProblems(problemRepo: ProblemRepository): Promise<void> {
  const existing = await problemRepo.findAll();
  if (existing.length === 0) {
    await problemRepo.saveMany(SEEDED_PROBLEMS);
    console.log(`[Database Seed] Successfully seeded ${SEEDED_PROBLEMS.length} LLD problems.`);
  }
}
