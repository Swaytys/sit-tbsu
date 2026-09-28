Create a desktop-first internal web application mockup and functional prototype in Indonesian for a building materials store called “UD. Sumber Urip”. This is not an ecommerce storefront. This is an internal operational system for sales and inventory management used by store staff. The design should feel like a real business information system: clean, modern, efficient, dense but readable, practical, professional, and easy to use during busy store hours. Use a neutral light interface with strong visual hierarchy, white and slate surfaces, subtle borders, rounded corners, compact tables, and clear action buttons. Prioritize usability, speed, clarity, and role-based workflows over decorative visuals.

Project context:
UD. Sumber Urip is a building materials store. The system scope is limited to Sales and Inventory. The store currently works manually, so the new system must solve fragmented recording, weak stock control, incomplete sales records, unclear return tracking, and lack of structured reports. The output should look like a realistic internal admin dashboard / POS-operational system, not a marketing website.

Main users and access levels:
1. Owner
- Highest access
- Can access all modules
- Can view all reports
- Can manage users
- Can access sensitive information like cost price and gross profit
- Can authorize sensitive actions such as void

2. Admin
- Handles operational and inventory-sensitive work
- Can manage goods, customers, suppliers, selling prices, stock in, stock out, stock adjustments, and operational user accounts
- Can access inventory and operational reports
- Can perform void with authorization level below owner but above cashier

3. Cashier
- Focuses on completing sales transactions
- Can receive incoming orders
- Can verify items
- Can do checkout
- Can print receipt / invoice
- Can receive payment and give change
- Can record sales returns
- Can perform clerical check
- Can create order directly in urgent situations
- Can request void authorization

4. Sales Staff
- Frontline user
- Helps customers choose items
- Checks stock
- Creates sales orders
- Inputs customer data for delivery transactions
- Must not access sensitive financial data or final payment processing

Core business rules:
- The system must distinguish between:
  a. Penjualan Langsung (direct sales at store / quick retail sales)
  b. Penjualan Pengantaran (delivery sales)
- The system uses an order → checkout model
- Sales Staff creates order first, then Cashier verifies and completes checkout
- Cashier must also be able to create order + checkout directly for faster handling during busy hours
- Delivery sales must support customer identity, delivery address, delivery document, payment status, and shipping status
- Direct sales usually use cash and must remain fast
- Returns must be recorded as formal transactions, not by editing old sales
- Stock mutation must update automatically from sales, returns, goods receipt, void, and stock adjustments
- The system must support multi-level selling prices:
  - retail
  - regular wholesale
  - distributor wholesale
- The system must support stock minimum warnings
- Void must require authorization and leave audit trail
- Clerical check must compare physical cash with recorded sales at end of shift
- Gross profit report is needed, but not full accounting profit/loss

Design what the app should include:
A. Authentication / Login
- Login page for internal users
- Clean, professional, secure
- Role-based system access

B. Main dashboard
- Operational dashboard with summary cards
- Show sales summary, active orders, delivery transactions, low stock alerts, and quick actions
- Show today’s activity and important notifications
- Make it feel useful for Owner/Admin/Cashier

C. Master Data modules
1. Master Barang
- Table view + detail / form view
- Fields should visually support:
  code, item name, category, brand, unit, default cost price, retail price, regular wholesale price, distributor wholesale price, minimum stock, status active
- Also include optional detailed product attributes:
  size, length, weight, volume, color, shape, texture, function, watt, image
- Include search, filter, status, and edit/add actions

2. Master Pelanggan
- Customer list, detail form
- Suitable especially for delivery customers
- Fields: name, phone, email, address, notes, active status

3. Master Supplier
- Supplier list and form
- Fields: supplier name, phone, address, notes, active status

4. Master Pengguna
- Internal user management
- Name, username, role, status, phone number

D. Order Penjualan module
- Used mainly by Sales Staff and Cashier
- Must show order form and order queue
- Support order status such as waiting, verified, pending, completed
- For delivery transaction, ask for customer data
- For direct sales, customer may be general / optional
- Important UX need: cashier must be able to choose which order to process first when many orders come in
- Show queue / priority behavior visually
- Make it look like a practical order basket system for a busy store

E. Penjualan Langsung module
- Fast cashier checkout screen
- Designed for quick in-store transactions
- Show selected items, quantities, unit prices, discounts if any, subtotal, total, payment amount, and change
- Must be compact and quick to operate
- Include print receipt action
- Make it feel like a hybrid POS + admin screen, not a public POS kiosk

F. Penjualan Pengantaran & Pembayaran module
- Delivery transaction screen
- Show invoice data, customer data, delivery address, item details, total amount, payment method, payment history, remaining balance, and shipping status
- Support payment scenarios:
  - paid in full
  - DP / partial payment
  - COD
  - later payment / receivable-like status within sales scope
- Include Surat Jalan generation
- Include payment status and delivery status timeline
- Make the screen suitable for operations and monitoring

G. Retur Penjualan module
- Return transaction screen
- Record original sales reference, returned items, quantity, reason for return, return value, and resolution type
- Keep transaction history visible
- Show stock impact clearly

H. Penerimaan Barang module
- Record incoming goods from supplier
- Show supplier, receipt number, item details, quantity received, cost price per item, subtotal, notes
- Stock increases automatically

I. Persediaan / Inventory module
- Inventory dashboard and control screen
- Must show:
  current stock
  stock mutations
  minimum stock alerts
  stock adjustment
  stock opname / physical stock correction
- Include item stock card concept
- Visually show which items are safe, low stock, or require action

J. Void Transaksi
- Sensitive workflow
- Cashier can request void
- Admin or Owner authorizes
- Must visually show authorization step and audit trail
- Can apply to item-level void or transaction-level void
- Stock impact should be reflected

K. Clerical Check
- End-of-shift cash reconciliation screen
- Compare recorded cash sales vs physical cash
- Show difference / selisih
- Save clerical result with notes

L. Reports module
Create realistic report-oriented UI screens, filters, and preview tables for:
1. Laporan Stok Rekap
2. Laporan Kartu Stok
3. Laporan Stok Minimum
4. Laporan Nilai Persediaan
5. Laporan Penjualan per Periode
6. Laporan Produk Terlaris
7. Laporan Detail Invoice
8. Laporan Retur Penjualan
9. Laporan Gross Profit Penjualan

Important report note:
- Gross profit report should show sales value, recorded cost/purchase value, and gross profit difference
- Do not design full accounting features like balance sheet, cash flow, or full profit/loss statement

UX and layout requirements:
- Desktop-first admin layout
- Left sidebar navigation
- Top bar with search, notifications, user info, and quick actions
- Use data tables, forms, cards, status chips, tabs, filters, and modal/dialog patterns
- Make screens interconnected and realistic
- Prioritize internal workflow clarity
- Use Indonesian labels for menus, forms, buttons, table headers, and statuses
- Make sure the mockup feels like a coherent integrated system, not separate unrelated screens
- Create multiple connected pages / views, not just one landing screen

Prototype behavior to simulate:
- Clicking from order queue to checkout
- Moving between direct sales and delivery sales
- Opening item detail and editing master data
- Opening report filter and report detail
- Basic transitions between key screens
- Visible interactive buttons, queue selection, status changes, and drilldown behavior

Content style:
- Use realistic placeholder data related to building materials store operations
- Example items: semen, cat, pipa PVC, besi beton, triplek, baja ringan, alat tukang, perlengkapan listrik, perlengkapan kamar mandi
- Keep copy practical and operational
- Avoid lorem ipsum
- Use believable Indonesian business labels, transaction numbers, and report names

Final goal:
Generate a polished, realistic internal system mockup/prototype for “Sistem Informasi Terintegrasi UD. Sumber Urip” covering Sales and Inventory, suitable as a university KP design deliverable and as a foundation for later manual refinement in Figma Design.