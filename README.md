# Omnichannel Retail OS & ERP 

> A secure, full-stack Enterprise Resource Planning (ERP) system architected to automate multi-store inventory, visualize high-frequency sales data, and enforce strict role-based access across retail networks.

*Note: The source code for this project remains in a private repository to protect proprietary business logic and internal data. This repository serves as a high-level architectural overview and case study.*

## 📌 Architectural Overview
Managing high-frequency data entry, multi-tier channel pricing, and supply chain bottlenecks requires a highly scalable solution. This custom ERP-lite dashboard replaces fragmented operational workflows with a single, centralized source of truth. 

Developed using an agentic AI workflow, this system was rapidly prototyped and deployed into production, significantly reducing development cycles while maintaining enterprise-grade security.

## ⚙️ Technical Stack
* **Framework:** Next.js 16 (App Router) & React 19
* **Backend Logic:** Next.js Server Actions (Controller-less architecture)
* **Database:** Supabase / PostgreSQL
* **Security:** Supabase Auth (JWT), Row Level Security (RLS)
* **Validation:** Zod & React Hook Form
* **Styling:** Tailwind CSS v4

## 🔐 Core System Architecture

### 1. Atomic Database Transactions
To prevent race conditions during high-volume sales periods, inventory decrements and transaction logging are handled via atomic PostgreSQL RPCs (e.g., `decrement_inventory` and `create_transaction_with_items`) directly at the database level. 

### 2. Advanced Multi-Tenant Security (RLS)
Data isolation is strictly enforced at the database layer. Utilizing PostgreSQL Row Level Security (RLS) combined with a custom `get_user_store_ids` RPC, staff members are mathematically restricted to viewing and mutating data solely within their assigned physical stores.

### 3. Server-Side Role-Based Access Control (RBAC)
Pricing visibility is dynamically filtered server-side. Field-level security ensures that retail staff, B2B dealers, and system admins receive varying JSON payloads. For instance, staff never receive wholesale dealer pricing (`price_buy`) in the client browser.

### 4. Fiscal Calendar & Automated Reporting
The analytics engine bypasses standard calendar grouping, utilizing a custom SQL-driven Fiscal Calendar to accurately aggregate Gross Merchandise Value (GMV), run rates, and period-over-period sales achievements for automated managerial reporting.

## 📈 Business Impact
By transitioning from manual operational tracking to this custom automated architecture, the operation successfully:
* **Eliminated inventory discrepancies** through atomic, real-time stock deductions.
* **Automated compliance** via a rigid, immutable PostgreSQL `audit_log` tracking every `INSERT`, `UPDATE`, and `DELETE` event across the system.
* **Streamlined B2B operations** by generating automated, VAT-calculated PDF Purchase Orders directly from the dealer portal.

## 🖼️ Interface Preview
*(Insert a high-quality, sanitized screenshot of your Sales Dashboard or Inventory Matrix here)*
