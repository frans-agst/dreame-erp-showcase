# Dreame Retail ERP - Dependencies Explained

**Purpose:** Documentation of all project dependencies and the rationale behind each technology choice.  
**Date:** March 2026  
**Project:** Dreame Retail ERP System

---

## Production Dependencies

### Core Framework & Runtime

#### **Next.js 16.1.2**
```json
"next": "16.1.2"
```

**Why we use it:**
- **Full-stack framework**: Combines frontend and backend in one codebase with API routes and Server Actions
- **App Router**: Modern routing with React Server Components for better performance
- **Server-side rendering (SSR)**: Improves SEO and initial page load performance
- **Built-in optimization**: Automatic code splitting, image optimization, and font optimization
- **Vercel deployment**: Seamless deployment with zero configuration
- **TypeScript support**: First-class TypeScript integration out of the box

**Use cases in our project:**
- Server Actions for database operations (`src/actions/`)
- API routes for special endpoints (`src/app/api/`)
- File-based routing for all pages
- Middleware for authentication checks

---

#### **React 19.2.3 & React DOM 19.2.3**
```json
"react": "19.2.3",
"react-dom": "19.2.3"
```

**Why we use it:**
- **Industry standard**: Most popular UI library with massive ecosystem
- **Component-based**: Reusable UI components for consistent design
- **React 19 features**: Latest features including improved Server Components
- **Hooks**: Modern state management with useState, useEffect, useCallback
- **Virtual DOM**: Efficient UI updates and rendering

**Use cases in our project:**
- All UI components (`src/components/`)
- Page components (`src/app/`)
- State management for forms and data
- Client-side interactivity

---

### Database & Authentication

#### **Supabase Client 2.90.1 & SSR 0.8.0**
```json
"@supabase/supabase-js": "^2.90.1",
"@supabase/ssr": "^0.8.0"
```

**Why we use it:**
- **PostgreSQL backend**: Powerful relational database with ACID compliance
- **Row Level Security (RLS)**: Database-level security policies for multi-tenant data isolation
- **Real-time subscriptions**: Live data updates (not currently used but available)
- **Built-in authentication**: JWT-based auth with role management
- **RESTful API**: Auto-generated API from database schema
- **SSR support**: Proper cookie handling for Next.js server-side rendering
- **Free tier**: Generous free tier for development and small deployments

**Use cases in our project:**
- All database queries (`src/actions/`)
- User authentication and session management
- RLS policies for staff/store isolation
- Audit logging with triggers
- File storage for receipts (if needed)

**Why not alternatives:**
- **vs Firebase**: Better SQL support, more control over database, no vendor lock-in
- **vs Prisma + PostgreSQL**: Supabase provides auth, RLS, and API out of the box
- **vs MongoDB**: Need relational data with complex joins and transactions

---

### Form Management & Validation

#### **React Hook Form 7.71.1**
```json
"react-hook-form": "^7.71.1"
```

**Why we use it:**
- **Performance**: Minimal re-renders, uncontrolled components by default
- **Developer experience**: Simple API with TypeScript support
- **Built-in validation**: Form validation without external libraries
- **Small bundle size**: ~9KB minified + gzipped
- **Resolver pattern**: Easy integration with validation libraries like Zod

**Use cases in our project:**
- Sales input form with multiple fields
- Purchase order creation form
- Product management forms
- Staff assignment forms
- All forms with validation requirements

**Why not alternatives:**
- **vs Formik**: Better performance, smaller bundle, more modern API
- **vs native forms**: Need complex validation, error handling, and state management

---

#### **Zod 4.3.5**
```json
"zod": "^4.3.5"
```

**Why we use it:**
- **TypeScript-first**: Infers TypeScript types from schemas automatically
- **Runtime validation**: Validates data at runtime, not just compile time
- **Composable schemas**: Build complex validations from simple primitives
- **Error messages**: Detailed, customizable error messages
- **Server-side validation**: Same schemas work on client and server

**Use cases in our project:**
- Input validation for all server actions (`src/lib/validations/`)
- Form validation with React Hook Form
- API request/response validation
- Type-safe data parsing

**Why not alternatives:**
- **vs Yup**: Better TypeScript support, more modern API
- **vs Joi**: Zod is TypeScript-native, smaller bundle for frontend
- **vs manual validation**: Type safety, reusability, consistency

---

#### **@hookform/resolvers 5.2.2**
```json
"@hookform/resolvers": "^5.2.2"
```

**Why we use it:**
- **Bridge library**: Connects React Hook Form with Zod validation
- **Official integration**: Maintained by React Hook Form team
- **Type safety**: Preserves TypeScript types through the validation chain

**Use cases in our project:**
- All forms that use both React Hook Form and Zod
- Ensures validation errors are properly formatted for display

---

### Data Visualization

#### **Recharts 3.6.0**
```json
"recharts": "^3.6.0"
```

**Why we use it:**
- **React-native**: Built specifically for React with component-based API
- **Declarative**: Easy to use with JSX syntax
- **Responsive**: Charts automatically adapt to container size
- **Customizable**: Full control over styling and behavior
- **Good documentation**: Well-documented with many examples
- **Lightweight**: Reasonable bundle size for the features provided

**Use cases in our project:**
- Dashboard GMV trends chart (line/bar charts)
- Sales achievement visualization
- Product performance charts
- Category breakdown charts

**Why not alternatives:**
- **vs Chart.js**: Recharts is more React-friendly, declarative API
- **vs D3.js**: Too complex for our needs, steeper learning curve
- **vs Victory**: Recharts has better documentation and community

---

### Export Functionality

#### **@react-pdf/renderer 4.3.2**
```json
"@react-pdf/renderer": "^4.3.2"
```

**Why we use it:**
- **React components**: Create PDFs using familiar React syntax
- **Server-side rendering**: Generate PDFs on the server or client
- **Styling**: CSS-like styling with flexbox support
- **Professional output**: High-quality PDF generation
- **No external dependencies**: Pure JavaScript, no native binaries

**Use cases in our project:**
- Purchase Order PDF export (`src/lib/pdf/purchase-order.tsx`)
- Weekly Sales Report PDF export (`src/lib/pdf/weekly-sales-report.tsx`)
- Invoice generation (if needed)

**Why not alternatives:**
- **vs jsPDF**: React-pdf has better React integration and styling
- **vs Puppeteer**: No need for headless browser, lighter weight
- **vs server-side PDF libraries**: Want to generate PDFs in the browser too

---

#### **xlsx 0.18.5 (SheetJS)**
```json
"xlsx": "^0.18.5"
```

**Why we use it:**
- **Excel compatibility**: Full support for .xlsx, .xls, .csv formats
- **Read and write**: Can both parse and generate Excel files
- **Feature-rich**: Supports formulas, styling, multiple sheets
- **Battle-tested**: Industry standard for Excel manipulation in JavaScript
- **Client-side**: Works in the browser without server processing

**Use cases in our project:**
- Weekly Sales Report Excel export
- Inventory export to Excel
- Purchase Order export to Excel
- Bulk data import from Excel (if needed)

**Why not alternatives:**
- **vs ExcelJS**: SheetJS has better browser support and simpler API
- **vs CSV only**: Need proper Excel formatting with multiple columns
- **vs server-side Excel**: Want to generate files in the browser

---

## Development Dependencies

### Styling

#### **Tailwind CSS 4**
```json
"tailwindcss": "^4",
"@tailwindcss/postcss": "^4"
```

**Why we use it:**
- **Utility-first**: Rapid UI development with utility classes
- **No CSS files**: Styles are co-located with components
- **Consistent design**: Design system built into the framework
- **Purging**: Unused styles are automatically removed in production
- **Responsive**: Mobile-first responsive design utilities
- **Dark mode**: Built-in dark mode support (if needed)
- **Version 4**: Latest version with improved performance and DX

**Use cases in our project:**
- All component styling
- Responsive layouts
- Consistent spacing, colors, typography
- Custom design system in `tailwind.config.ts`

**Why not alternatives:**
- **vs CSS Modules**: Faster development, no naming conflicts
- **vs Styled Components**: Better performance, smaller bundle
- **vs Bootstrap**: More flexible, modern, better for custom designs

---

### TypeScript

#### **TypeScript 5**
```json
"typescript": "^5",
"@types/node": "^20",
"@types/react": "^19",
"@types/react-dom": "^19"
```

**Why we use it:**
- **Type safety**: Catch errors at compile time, not runtime
- **Better IDE support**: Autocomplete, refactoring, inline documentation
- **Self-documenting**: Types serve as documentation
- **Refactoring confidence**: Safe refactoring with type checking
- **Team collaboration**: Clear contracts between functions and components
- **Latest features**: TypeScript 5 has improved performance and features

**Use cases in our project:**
- All source code is TypeScript
- Type definitions in `src/types/`
- Ensures data consistency across the application

**Why not alternatives:**
- **vs JavaScript**: Type safety is critical for a business application
- **vs Flow**: TypeScript has better ecosystem and tooling

---

### Testing

#### **Vitest 4.0.17**
```json
"vitest": "^4.0.17",
"@vitejs/plugin-react": "^5.1.2",
"jsdom": "^27.4.0"
```

**Why we use it:**
- **Fast**: Vite-powered, instant test execution
- **Jest-compatible**: Familiar API for developers who know Jest
- **ESM support**: Native ES modules support, no transpilation needed
- **Watch mode**: Instant feedback during development
- **TypeScript**: First-class TypeScript support
- **React Testing**: Works seamlessly with React components

**Use cases in our project:**
- Unit tests for server actions (`src/actions/*.test.ts`)
- Component tests for UI components
- Integration tests for complex workflows
- Test coverage reporting

**Why not alternatives:**
- **vs Jest**: Vitest is faster and has better ESM support
- **vs Mocha/Chai**: Vitest has better DX and built-in features

---

#### **fast-check 4.5.3**
```json
"fast-check": "^4.5.3"
```

**Why we use it:**
- **Property-based testing**: Test with random inputs to find edge cases
- **Shrinking**: Automatically finds minimal failing cases
- **Comprehensive**: Tests many scenarios automatically
- **Complements unit tests**: Finds bugs that example-based tests miss

**Use cases in our project:**
- Testing calculation functions with random inputs
- Validating business logic with edge cases
- Ensuring data integrity with property tests

**Why not alternatives:**
- **vs manual test cases**: Finds edge cases we wouldn't think of
- **vs JSVerify**: fast-check is more modern and actively maintained

---

### Code Quality

#### **ESLint 9**
```json
"eslint": "^9",
"eslint-config-next": "16.1.2"
```

**Why we use it:**
- **Code consistency**: Enforces consistent code style across the team
- **Bug prevention**: Catches common mistakes and anti-patterns
- **Best practices**: Enforces React and Next.js best practices
- **Customizable**: Can add custom rules for our specific needs
- **IDE integration**: Real-time feedback in VS Code

**Use cases in our project:**
- Linting all TypeScript and React code
- Enforcing Next.js conventions
- Pre-commit hooks (if configured)

**Why not alternatives:**
- **vs Prettier only**: ESLint catches logic errors, not just formatting
- **vs TSLint**: TSLint is deprecated, ESLint is the standard

---

## Technology Stack Summary

### Why This Stack?

1. **Modern & Performant**: Latest versions of React, Next.js, and TypeScript
2. **Type-Safe**: End-to-end type safety from database to UI
3. **Developer Experience**: Fast development with hot reload, TypeScript, and Tailwind
4. **Production-Ready**: Battle-tested libraries used by thousands of companies
5. **Scalable**: Can handle growth from small team to large enterprise
6. **Cost-Effective**: Generous free tiers (Supabase, Vercel)
7. **Maintainable**: Clear separation of concerns, well-documented code

### Architecture Decisions

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  React 19 + Next.js 16 + Tailwind CSS + TypeScript         │
│  (Components, Pages, Client-side Logic)                     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Server Actions                          │
│  Next.js Server Actions + Zod Validation                    │
│  (Business Logic, Data Validation)                          │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  Supabase (PostgreSQL + RLS + Auth)                        │
│  (Data Storage, Security, Authentication)                   │
└─────────────────────────────────────────────────────────────┘
```

### Bundle Size Considerations

**Total Production Bundle (estimated):**
- Next.js runtime: ~90KB
- React 19: ~45KB
- Supabase client: ~50KB
- React Hook Form: ~9KB
- Zod: ~13KB
- Recharts: ~100KB (code-split per page)
- xlsx: ~500KB (code-split, only loaded on export)
- @react-pdf/renderer: ~200KB (code-split, only loaded on export)

**Total: ~300KB initial load, ~800KB with all features loaded**

This is reasonable for a business application with rich features.

---

## Version Strategy

### Pinned Versions
- **Next.js**: Pinned to exact version (16.1.2) for stability
- **React**: Pinned to exact version (19.2.3) for compatibility

### Caret Versions (^)
- **All other dependencies**: Allow patch and minor updates
- **Rationale**: Get bug fixes and features while avoiding breaking changes

### Update Strategy
1. **Monthly**: Review and update dependencies
2. **Security**: Immediate updates for security vulnerabilities
3. **Major versions**: Test thoroughly before upgrading
4. **Breaking changes**: Update one dependency at a time

---

## Future Considerations

### Potential Additions

1. **@tanstack/react-query**: For better server state management
   - **When**: If we need more complex data fetching patterns
   - **Why**: Better caching, background refetching, optimistic updates

2. **react-i18next**: For internationalization
   - **When**: If we need to support multiple languages
   - **Why**: Industry standard for i18n in React

3. **date-fns**: For date manipulation
   - **When**: If we need more complex date operations
   - **Why**: Lightweight, tree-shakeable, better than moment.js

4. **@supabase/realtime-js**: For real-time features
   - **When**: If we need live updates (e.g., inventory changes)
   - **Why**: Already using Supabase, seamless integration

### Potential Removals

1. **fast-check**: If property-based testing isn't used
   - **Consider**: Remove if team doesn't write property tests
   - **Impact**: ~100KB dev dependency

---

**End of Dependencies Documentation**
