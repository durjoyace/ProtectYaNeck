# ProtectYaNeck - Implementation Plan

## Overview
Chrome extension that scans sign-up/agreement pages, highlights legal risks, and provides plain-language summaries with a freemium business model.

---

## Phase 1: Proof of Concept (2 days)

### 1.1 Project Setup
- [ ] Initialize Chrome extension structure (manifest v3)
- [ ] Set up development environment (webpack/vite for bundling)
- [ ] Create basic folder structure:
  ```
  /src
    /background     # Service worker
    /content        # Content scripts
    /popup          # Extension popup UI
    /components     # Shared UI components
    /utils          # Helper functions
    /services       # API/LLM services
  /assets           # Icons, images
  /styles           # CSS/styling
  ```
- [ ] Configure manifest.json with required permissions (activeTab, storage, scripting)

### 1.2 Agreement Detection (Core)
- [ ] Create content script for DOM scanning
- [ ] Build detection patterns for:
  - Terms of Service pages (URL patterns, page titles, keywords)
  - Sign-up forms with checkboxes/agreements
  - Modal/popup agreements
  - Embedded ToS links and iframes
- [ ] Implement MutationObserver for dynamic content (SPAs)
- [ ] Create confidence scoring for agreement detection

### 1.3 Basic Summary Overlay
- [ ] Design minimal overlay UI component
- [ ] Implement shadow DOM injection (avoid CSS conflicts)
- [ ] Create "scanning" indicator animation
- [ ] Build basic summary card layout
- [ ] Add close/minimize functionality

---

## Phase 2: MVP Build (7 days)

### 2.1 Risk Analysis Engine

#### 2.1.1 Text Extraction
- [ ] Extract agreement text from detected pages
- [ ] Handle various formats (inline text, linked documents, PDFs)
- [ ] Clean and normalize extracted text
- [ ] Chunk large documents for processing

#### 2.1.2 Local LLM Integration
- [ ] Integrate WebLLM or similar browser-based LLM
- [ ] Create risk analysis prompt templates
- [ ] Define risk categories:
  - **Data Sharing** - Third-party data sharing, selling data
  - **Auto-Renewal** - Subscription auto-renewal, cancellation terms
  - **Third-Party Access** - Who can access your data
  - **Liability Waivers** - Limitation of liability clauses
  - **Arbitration** - Mandatory arbitration, class action waivers
  - **Data Retention** - How long data is kept
  - **Opt-Out Difficulty** - Account deletion complexity
- [ ] Implement risk severity scoring (Low/Medium/High/Critical)
- [ ] Build fallback to cloud API (optional, privacy-respecting)

#### 2.1.3 Summary Generation
- [ ] Create plain-language summary templates
- [ ] Generate bullet-point risk summaries
- [ ] Highlight specific concerning clauses with page locations

### 2.2 User Interface

#### 2.2.1 Popup Interface
- [ ] Design clean, minimal popup UI
- [ ] Show current page scan status
- [ ] Display scan counter (X/5 free scans remaining)
- [ ] Quick settings toggle
- [ ] Upgrade CTA button
- [ ] "Need a lawyer?" button

#### 2.2.2 Content Overlay (Enhanced)
- [ ] Risk highlighting directly on page text
- [ ] Color-coded severity indicators (green/yellow/orange/red)
- [ ] Expandable risk cards with details
- [ ] "View full summary" option
- [ ] Smooth animations and transitions

#### 2.2.3 Settings Page
- [ ] Whitelist management (trusted sites)
- [ ] Notification preferences
- [ ] Detection sensitivity settings
- [ ] Privacy controls
- [ ] Account/subscription status

### 2.3 Freemium & Subscription System

#### 2.3.1 Usage Tracking
- [ ] Implement scan counter in chrome.storage
- [ ] Monthly reset logic
- [ ] Track usage per device (free) / per account (paid)
- [ ] Display usage in popup and overlay

#### 2.3.2 Tier Logic
- [ ] Define feature flags:
  ```javascript
  FREE_TIER = {
    scansPerMonth: 5,
    basicRiskAnalysis: true,
    advancedClauses: false,
    scanHistory: false,
    cloudSync: false,
    prioritySupport: false
  }

  PAID_TIER = {
    scansPerMonth: Infinity,
    basicRiskAnalysis: true,
    advancedClauses: true,
    scanHistory: true,
    cloudSync: true,
    prioritySupport: true
  }
  ```
- [ ] Implement entitlement checking
- [ ] Graceful degradation when limits reached

#### 2.3.3 Payment Integration (Stripe)
- [ ] Set up Stripe account and products
- [ ] Create subscription plans (monthly/annual)
- [ ] Build secure payment flow (redirect to hosted checkout)
- [ ] Implement webhook handler for subscription events
- [ ] License key validation system

### 2.4 Lead Generation System

#### 2.4.1 Lawyer Referral UI
- [ ] "Need a lawyer?" button placement strategy
- [ ] Contextual trigger (show on high-risk agreements)
- [ ] Lead capture form design:
  - Name, email, phone (optional)
  - Agreement URL/context
  - Specific concern selection
  - Preferred contact method
- [ ] Confirmation/thank you flow

#### 2.4.2 Backend API
- [ ] Lead submission endpoint
- [ ] Data validation and sanitization
- [ ] Partner routing logic
- [ ] Email notifications to legal partners
- [ ] Analytics tracking (submission rates, conversions)

### 2.5 Backend Infrastructure

#### 2.5.1 Lightweight API Server
- [ ] Choose stack (Node.js/Express or serverless)
- [ ] Endpoints needed:
  - `POST /api/leads` - Submit lawyer referral
  - `POST /api/subscription/verify` - Verify subscription status
  - `GET /api/subscription/portal` - Stripe customer portal
  - `POST /api/feedback` - User feedback submission
  - `POST /webhooks/stripe` - Stripe webhook handler
- [ ] Authentication middleware (API keys for extension)
- [ ] Rate limiting

#### 2.5.2 Database Schema
- [ ] Users table (email, subscription status, created_at)
- [ ] Leads table (user_id, agreement_url, concern, status, partner_id)
- [ ] Feedback table (user_id, type, message, created_at)
- [ ] Analytics events table

---

## Phase 3: Early User Feedback (3 days)

### 3.1 Beta Distribution
- [ ] Package extension for sideloading
- [ ] Create installation instructions
- [ ] Set up beta user group (10-20 users)
- [ ] Create feedback collection mechanism

### 3.2 Analytics Integration
- [ ] Implement privacy-respecting analytics
- [ ] Track key events:
  - Extension installed/activated
  - Agreement detected
  - Scan completed
  - Risk displayed
  - Upgrade CTA clicked
  - Lawyer referral initiated
  - Feedback submitted
- [ ] Set up dashboard for monitoring

### 3.3 Feedback & Iteration
- [ ] In-extension feedback widget
- [ ] Bug reporting flow
- [ ] Feature request collection
- [ ] Prioritize fixes based on feedback
- [ ] UX improvements based on user behavior

---

## Phase 4: Public Launch (2 days)

### 4.1 Chrome Web Store Preparation
- [ ] Create store listing assets:
  - Extension icon (128x128, 48x48, 16x16)
  - Promotional images (1280x800, 640x400)
  - Screenshots (1280x800)
- [ ] Write compelling store description
- [ ] Prepare privacy policy
- [ ] Complete Chrome Web Store developer registration

### 4.2 Submission & Review
- [ ] Final QA testing
- [ ] Security audit (no vulnerabilities)
- [ ] Submit to Chrome Web Store
- [ ] Address any review feedback

### 4.3 Launch Marketing
- [ ] Landing page setup
- [ ] Social media announcements
- [ ] Product Hunt submission (optional)
- [ ] Legal partner outreach for referral network

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Popup     │  │  Content    │  │  Background         │ │
│  │   (React)   │  │  Script     │  │  Service Worker     │ │
│  │             │  │             │  │                     │ │
│  │ - Status    │  │ - DOM Scan  │  │ - LLM Processing    │ │
│  │ - Settings  │  │ - Overlay   │  │ - Storage Manager   │ │
│  │ - Upgrade   │  │ - Highlight │  │ - API Calls         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                            │                                 │
│                   chrome.storage.local                       │
│                   (usage, settings, cache)                   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   API       │  │   Stripe    │  │   Database          │ │
│  │   Server    │◄─┤   Webhooks  │  │   (PostgreSQL)      │ │
│  │             │  │             │  │                     │ │
│  │ - Leads     │  │ - Sub mgmt  │  │ - Users             │ │
│  │ - Auth      │  │ - Payments  │  │ - Leads             │ │
│  │ - Feedback  │  │             │  │ - Analytics         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
ProtectYaNeck/
├── manifest.json
├── package.json
├── webpack.config.js
├── README.md
├── IMPLEMENTATION_PLAN.md
│
├── src/
│   ├── background/
│   │   ├── index.ts              # Service worker entry
│   │   ├── llm-service.ts        # LLM processing
│   │   ├── storage-manager.ts    # Chrome storage operations
│   │   └── api-client.ts         # Backend API calls
│   │
│   ├── content/
│   │   ├── index.ts              # Content script entry
│   │   ├── detector.ts           # Agreement detection logic
│   │   ├── extractor.ts          # Text extraction
│   │   ├── highlighter.ts        # Risk highlighting on page
│   │   └── overlay/
│   │       ├── Overlay.tsx       # Main overlay component
│   │       ├── SummaryCard.tsx   # Risk summary display
│   │       └── styles.css        # Overlay styles
│   │
│   ├── popup/
│   │   ├── index.html
│   │   ├── index.tsx             # Popup entry
│   │   ├── App.tsx               # Main popup app
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ScanCounter.tsx
│   │   │   ├── UpgradeButton.tsx
│   │   │   └── LawyerButton.tsx
│   │   └── styles.css
│   │
│   ├── options/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── Settings.tsx
│   │
│   ├── shared/
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── constants.ts          # App constants
│   │   ├── risk-categories.ts    # Risk definitions
│   │   └── tier-config.ts        # Free/paid tier config
│   │
│   └── services/
│       ├── analytics.ts          # Privacy-respecting analytics
│       ├── subscription.ts       # Subscription management
│       └── leads.ts              # Lead generation service
│
├── assets/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── images/
│
├── backend/                      # Optional: if self-hosting
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── services/
│   └── prisma/
│       └── schema.prisma
│
└── docs/
    ├── PRIVACY_POLICY.md
    └── STORE_LISTING.md
```

---

## Risk Categories & Detection Patterns

| Risk Category | Severity | Keywords/Patterns |
|---------------|----------|-------------------|
| Data Sharing | High | "share with third parties", "partners", "affiliates", "sell your data" |
| Auto-Renewal | Medium | "automatically renew", "recurring", "cancel before", "billing cycle" |
| Third-Party Access | High | "service providers", "contractors", "access your information" |
| Liability Waiver | High | "limitation of liability", "not responsible", "no warranty", "as is" |
| Arbitration | Critical | "binding arbitration", "waive right to jury", "class action waiver" |
| Data Retention | Medium | "retain your data", "indefinitely", "after termination" |
| Jurisdiction | Low | "governed by laws of", "exclusive jurisdiction", "venue" |
| Account Termination | Medium | "terminate at any time", "without notice", "sole discretion" |

---

## API Endpoints Specification

### Lead Submission
```
POST /api/leads
{
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",        // optional
  "agreementUrl": "https://...",
  "agreementTitle": "Service ToS",
  "concern": "data_sharing",     // enum
  "riskSummary": "...",
  "contactMethod": "email"
}

Response: { "success": true, "leadId": "..." }
```

### Subscription Verification
```
POST /api/subscription/verify
{
  "licenseKey": "PYN-XXXX-XXXX"
}

Response: {
  "valid": true,
  "tier": "paid",
  "expiresAt": "2025-12-31"
}
```

---

## Success Metrics to Track

| Metric | Target | Tracking Method |
|--------|--------|-----------------|
| Installs | 10,000 in 3 months | Chrome Web Store |
| Install-to-activation | 20% conversion | Analytics |
| Free-to-paid conversion | 5% in year 1 | Stripe + Analytics |
| Legal leads/month | 50 by Q2 | Backend database |
| Risk reduction | 30%+ flagged elements acted on | Analytics |
| User feedback | 500 unique users Q1 | Feedback widget |

---

## Development Priorities (Recommended Order)

1. **Agreement Detection** - Foundation of the product
2. **Risk Analysis Engine** - Core value proposition
3. **Basic Overlay UI** - User sees value immediately
4. **Usage Tracking** - Enable freemium model
5. **Popup Interface** - User control center
6. **Payment Integration** - Monetization
7. **Lead Generation** - Revenue stream #2
8. **Settings/Whitelist** - Power user features
9. **Analytics** - Measure success
10. **Polish & Launch** - Store submission

---

## Next Steps

1. **Start Phase 1.1** - Set up project structure and manifest
2. **Build detection logic** - Core agreement scanning
3. **Create basic overlay** - Show something works
4. **Iterate** - Add features progressively

Ready to begin implementation?
