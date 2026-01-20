# Badge Box Use Cases

This document presents real-world scenarios for using Badge Box. Each use case includes the context, implementation steps, and technical details.

---

## Table of Contents

1. [Community Recognition](#1-community-recognition)
2. [Event Attendance](#2-event-attendance)
3. [Course Completion](#3-course-completion)
4. [Professional Certification](#4-professional-certification)
5. [Membership & Access](#5-membership--access)
6. [Achievement System](#6-achievement-system)
7. [Contributor Recognition](#7-contributor-recognition)
8. [Identity Verification](#8-identity-verification)

---

## 1. Community Recognition

### Scenario

A Nostr community wants to recognize helpful members who answer questions and support newcomers.

### Implementation

**Badge: "Community Helper"**

| Field | Value |
|-------|-------|
| Identifier | `community-helper` |
| Name | Community Helper |
| Description | Awarded to members who consistently help others in our community |
| Image | URL to helper badge image |

**Workflow**:

1. Community moderators create the "Community Helper" badge
2. When a member demonstrates helpful behavior, moderators award the badge
3. Recipients accept the badge to display on their profile
4. Other community members can verify helpers by checking profiles

**Technical Details**:

```
Badge Definition (kind 30009):
a-tag: 30009:<moderator_pubkey>:community-helper

Award Event (kind 8):
References the badge definition
Tags helpful member's pubkey
```

**Benefits**:
- Public recognition for positive contributions
- Decentralized - no central authority controls the badge
- Verifiable by anyone on Nostr

---

## 2. Event Attendance

### Scenario

A conference organizer wants to provide proof-of-attendance badges to participants.

### Implementation

**Badge: "NostrCon 2024 Attendee"**

| Field | Value |
|-------|-------|
| Identifier | `nostrcon-2024` |
| Name | NostrCon 2024 Attendee |
| Description | Attended NostrCon 2024 in person |
| Image | Conference logo or themed badge image |

**Workflow**:

1. Before the event, organizer creates the attendance badge
2. At the event, collect attendee npubs (via QR codes, registration)
3. After verification, batch award the badge to all attendees
4. Attendees accept to prove their attendance

**Technical Details**:

```
Single award event with multiple recipients:

Kind 8 Event Tags:
["a", "30009:<organizer>:nostrcon-2024"]
["p", "<attendee_1_hex>"]
["p", "<attendee_2_hex>"]
["p", "<attendee_3_hex>"]
... (up to hundreds of recipients)
```

**Variations**:
- Create separate badges for speakers, sponsors, volunteers
- Add year-specific identifiers for recurring events
- Include VIP or early-bird designation

---

## 3. Course Completion

### Scenario

An online educator wants to issue completion certificates for their Nostr development course.

### Implementation

**Badge: "Nostr Dev Course Graduate"**

| Field | Value |
|-------|-------|
| Identifier | `nostr-dev-101-complete` |
| Name | Nostr Development 101 |
| Description | Successfully completed the Nostr Development 101 course |
| Image | Course completion certificate image |

**Workflow**:

1. Instructor creates the completion badge
2. Students complete coursework and final project
3. Upon passing, instructor awards badge to the student
4. Student displays badge as proof of education

**Technical Details**:

Multiple course levels can use related identifiers:
- `nostr-dev-101-complete`
- `nostr-dev-201-complete`
- `nostr-dev-301-complete`

The instructor's public key acts as the certificate authority. Anyone can verify a completion claim by checking if the badge was issued by the official instructor key.

**Extended Implementation**:

For detailed credentials, the badge description can include:
- Course curriculum version
- Completion date range
- Skills covered
- Link to course materials

---

## 4. Professional Certification

### Scenario

A professional organization wants to certify practitioners in their field.

### Implementation

**Badge: "Certified Nostr Developer"**

| Field | Value |
|-------|-------|
| Identifier | `certified-nostr-dev-2024` |
| Name | Certified Nostr Developer |
| Description | Passed the Nostr Developer Certification exam (2024) |
| Image | Official certification seal |

**Workflow**:

1. Certification body creates annual certification badges
2. Candidates take and pass certification exam
3. Upon passing, organization awards the certification badge
4. Employers can verify certification on candidate profiles

**Trust Model**:

The certification's value depends on:
- The reputation of the issuing organization
- Recognition of the organization's public key
- Community acceptance of the certification

**Verification Process**:

Employers verify certification by:
1. Check candidate's profile for the badge
2. Verify issuer pubkey matches known certification body
3. Confirm badge is accepted (appears in kind 30008)

---

## 5. Membership & Access

### Scenario

A private community uses badges to indicate membership status.

### Implementation

**Badge: "Inner Circle Member"**

| Field | Value |
|-------|-------|
| Identifier | `inner-circle-2024` |
| Name | Inner Circle Member |
| Description | Active member of the Inner Circle community (2024) |
| Image | Membership badge image |

**Workflow**:

1. Community admin creates membership badge
2. When membership is approved, admin awards badge
3. Member accepts to publicly show membership
4. Other services can check for badge before granting access

**Access Control Pattern**:

Third-party services can implement badge-based access:

```
1. User requests access
2. Service queries user's profile badges (kind 30008)
3. Check for required badge a-tag
4. Verify badge issuer is trusted authority
5. Grant or deny access
```

**Time-Limited Membership**:

For expiring memberships:
- Include year in identifier: `inner-circle-2024`
- Create new badge each period
- Old badges remain as historical record
- Check for current period badge only

---

## 6. Achievement System

### Scenario

A Nostr app wants to gamify user engagement with achievement badges.

### Implementation

**Badge Set: Engagement Milestones**

| Identifier | Name | Criteria |
|------------|------|----------|
| `first-post` | First Post | Published first note |
| `hundred-posts` | Centurion | Published 100 notes |
| `thousand-posts` | Prolific Poster | Published 1000 notes |
| `first-follower` | Getting Started | Gained first follower |
| `hundred-followers` | Community Builder | Reached 100 followers |

**Workflow**:

1. App creates all achievement badges upfront
2. Backend monitors user activity
3. When milestone reached, automatically award badge
4. User can accept to display achievements

**Technical Implementation**:

Automated awarding system:
```python
# Pseudocode for automated badge awarding
def check_achievements(user_pubkey):
    post_count = get_user_post_count(user_pubkey)

    if post_count >= 1 and not has_badge(user, 'first-post'):
        award_badge(user_pubkey, 'first-post')

    if post_count >= 100 and not has_badge(user, 'hundred-posts'):
        award_badge(user_pubkey, 'hundred-posts')
```

**Considerations**:
- Automated systems need secure private key management
- Consider rate limiting to prevent spam
- Users choose which achievements to display

---

## 7. Contributor Recognition

### Scenario

An open source project wants to recognize contributors.

### Implementation

**Badge Set: Contributor Tiers**

| Identifier | Name | Criteria |
|------------|------|----------|
| `contributor` | Contributor | Made any contribution |
| `core-contributor` | Core Contributor | Significant ongoing contributions |
| `maintainer` | Project Maintainer | Active maintainer role |
| `founder` | Founding Contributor | Original project creator |

**Workflow**:

1. Project lead creates contributor badges
2. After merged PR, award `contributor` badge
3. Promote to higher tiers as involvement grows
4. Contributors display badges on their Nostr profile

**GitHub Integration Concept**:

```
1. Contributor adds npub to GitHub profile
2. Webhook fires on merged PR
3. Backend verifies GitHub <-> npub link
4. Automatically awards contributor badge
```

**Verification**:

Anyone can verify a claim by:
1. Check for badge from official project pubkey
2. Cross-reference with public contribution records
3. Badge serves as cryptographic proof of contribution

---

## 8. Identity Verification

### Scenario

A service wants to offer verified identity badges after KYC.

### Implementation

**Badge: "Verified Human"**

| Field | Value |
|-------|-------|
| Identifier | `verified-human-v1` |
| Name | Verified Human |
| Description | Identity verified through our KYC process |
| Image | Verification checkmark badge |

**Workflow**:

1. Verification service creates the verified badge
2. User completes KYC process
3. Upon successful verification, service awards badge
4. User displays verification status on profile

**Privacy Considerations**:

- Badge confirms verification without revealing personal details
- Verification service knows identity, but badge is pseudonymous
- User controls whether to display verification
- Different verification levels possible (email, phone, ID, etc.)

**Multi-Level Verification**:

| Identifier | Level | Requirement |
|------------|-------|-------------|
| `verified-email` | Basic | Email confirmation |
| `verified-phone` | Standard | Phone verification |
| `verified-id` | Full | Government ID check |

---

## Implementation Patterns

### Pattern 1: One-Time Award

Best for: Event attendance, course completion, one-time achievements

```
Create badge → Award to recipients → Done
```

### Pattern 2: Ongoing Recognition

Best for: Community helpers, contributors, ongoing behavior

```
Create badge → Award as earned → Award more over time
```

### Pattern 3: Time-Limited Status

Best for: Memberships, certifications, annual badges

```
Create dated badge → Award current members → Create new badge next period
```

### Pattern 4: Tiered System

Best for: Achievement systems, skill levels, contributor tiers

```
Create badge set → Award entry level → Promote through tiers
```

---

## Technical Considerations

### Badge Identifier Best Practices

**Do**:
- Use lowercase letters, numbers, hyphens
- Include version or year for time-sensitive badges
- Keep identifiers short but descriptive
- Use consistent naming across badge sets

**Don't**:
- Use spaces or special characters
- Change identifiers after awarding (creates new badge)
- Reuse identifiers for different purposes

**Examples**:
```
Good: community-helper, nostrcon-2024, verified-v1
Bad: Community Helper!, NostrCon, verified
```

### Image Hosting

Badge images should be:
- Hosted on reliable, permanent URLs
- Square aspect ratio (recommended)
- Reasonable file size (< 500KB)
- Accessible without authentication

**Recommended hosts**:
- GitHub raw content
- IPFS with gateway
- Dedicated image hosting
- Your own CDN

### Batch Operations

When awarding to many recipients:
- Single kind 8 event can include many `p` tags
- More efficient than individual awards
- All recipients receive simultaneously
- Relay limits may apply (test with your relays)

### Revocation Considerations

NIP-58 badges cannot be revoked by the issuer. Design considerations:

- Time-limited badges expire naturally
- Users can remove badges from their profile
- Award events remain as historical record
- Consider badge meaning carefully before awarding

---

## Integration Examples

### Checking for Badge in Code

```javascript
// Check if user has a specific badge
async function hasBadge(userPubkey, badgeATag) {
  // Query user's profile badges (kind 30008)
  const filter = {
    kinds: [30008],
    authors: [userPubkey],
    '#d': ['profile_badges']
  };

  const events = await queryRelays(filter);
  if (events.length === 0) return false;

  // Check if badge a-tag exists
  const profileBadges = events[0];
  return profileBadges.tags.some(
    tag => tag[0] === 'a' && tag[1] === badgeATag
  );
}

// Usage
const isMember = await hasBadge(
  userHexPubkey,
  '30009:issuer_hex:membership-2024'
);
```

### Building Badge-Gated Content

```javascript
// Middleware for badge-gated access
async function requireBadge(req, res, next) {
  const userPubkey = req.headers['x-pubkey'];
  const requiredBadge = '30009:your_pubkey:premium-member';

  if (!await hasBadge(userPubkey, requiredBadge)) {
    return res.status(403).json({
      error: 'Badge required',
      badge: requiredBadge
    });
  }

  next();
}
```

---

## Summary

Badge Box enables diverse credential and recognition systems on Nostr:

| Use Case | Key Benefit |
|----------|-------------|
| Community Recognition | Decentralized reputation |
| Event Attendance | Verifiable proof |
| Course Completion | Portable credentials |
| Professional Certification | Trust through issuer reputation |
| Membership | Badge-based access control |
| Achievement System | Gamification without central control |
| Contributor Recognition | Permanent contribution record |
| Identity Verification | Privacy-preserving verification |

The decentralized nature of Nostr badges means:
- No single point of failure
- Issuers maintain their own reputation
- Recipients control their display
- Anyone can verify claims independently
