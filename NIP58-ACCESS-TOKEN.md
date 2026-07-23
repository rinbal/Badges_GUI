# NIP-58 Badges als Access-Token

**Draft — März 2025**

---

## Zusammenfassung

Nostr Badges (NIP-58) werden über ihren ursprünglichen Zweck der Anerkennung hinaus als dezentraler Access-Control-Layer eingesetzt. Ein Badge = eine Berechtigung. Anwendungen prüfen beim Login, ob ein User einen bestimmten Badge hält, und gewähren oder verweigern entsprechend den Zugang.

Keine zentrale Datenbank. Kein OAuth. Kein separates Account-Management.

---

## Warum Badges?

Badges auf Nostr sind:

- **Öffentlich verifizierbar** — Jeder kann prüfen, wer einen Badge hält
- **Dezentral gespeichert** — Auf Nostr-Relays, keine Single Point of Failure
- **Kryptographisch signiert** — Fälschungssicher durch Nostr-Protokoll
- **Self-sovereign** — User kontrollieren, welche Badges sie anzeigen
- **Bereits deployed** — NIP-58 existiert, Relays unterstützen es, Clients können es lesen

Diese Eigenschaften machen Badges zu einem natürlichen, dezentralen Access-Token.

---

## Kernprinzip

```
Badge vorhanden + Issuer vertrauenswürdig = Zugang gewährt
```

Die Verifikation ist trivial:

1. Kind 30008 (Profile Badges) des Users abfragen
2. Prüfen ob der gewünschte Badge-a-tag vorhanden ist
3. Verifizieren dass der Issuer-Pubkey der erwartete ist
4. Zugang gewähren oder verweigern

```javascript
async function checkAccess(userPubkey, requiredBadge, trustedIssuer) {
  const filter = {
    kinds: [30008],
    authors: [userPubkey],
    '#d': ['profile_badges']
  };
  const events = await pool.querySync(relays, filter);
  if (events.length === 0) return false;

  return events[0].tags.some(tag =>
    tag[0] === 'a' &&
    tag[1] === requiredBadge &&
    tag[1].startsWith(`30009:${trustedIssuer}:`)
  );
}
```

---

## Anwendungsfälle

### 1. Digitale Events / Nostr Spaces

Ein Nostr Space oder Live-Event prüft beim Beitritt, ob der User den Event-Badge hält.

| Aspekt | Detail |
|--------|--------|
| Badge | `event-ticket-2025-03` |
| Issuer | Veranstalter-Pubkey |
| Prüfung | Beim Betreten des Spaces |
| Ablauf | Event-Datum im Identifier |

**Flow:** Ticket kaufen → Badge erhalten → Space beitreten → Badge wird geprüft → Zutritt

### 2. Premium-Content / Paywall

Badge-Holder sehen mehr Content als anonyme Besucher. Websites prüfen beim Nostr-Login den Badge-Status.

| Aspekt | Detail |
|--------|--------|
| Badge | `premium-reader-2025` |
| Issuer | Publisher-Pubkey |
| Prüfung | Beim Laden geschützter Inhalte |
| Ablauf | Jährlich neuer Badge |

**Flow:** Zahlung → Badge → Login auf beliebiger Partnerseite → Premium-Content sichtbar

### 3. Geschlossene Communities & Foren

Nur Badge-Inhaber können lesen oder posten. Moderatoren vergeben Badges als Mitgliedsausweis.

| Aspekt | Detail |
|--------|--------|
| Badge | `inner-circle-member` |
| Issuer | Community-Admin-Pubkey |
| Prüfung | Bei jedem Zugriff auf geschützte Bereiche |
| Ablauf | Dauerhaft oder jährlich |

### 4. Physischer Eintritt

Badge als Eintrittskarte für reale Events. Der Badge-Besitz wird am Eingang verifiziert.

| Aspekt | Detail |
|--------|--------|
| Badge | `conference-2025-attendee` |
| Issuer | Veranstalter-Pubkey |
| Prüfung | Am Eingang (QR-Code oder App) |
| Ablauf | Einmalig |

**Herausforderung:** UX am Eingang muss schnell sein. Lösungsansätze:
- QR-Code der den Badge-Besitz kodiert (offline-verifizierbar)
- Nostr-Login am Eingang mit sofortiger Badge-Prüfung
- Companion-App die den Badge als scannbaren Code darstellt

### 5. Membership / Newsletter

Einmalige oder wiederkehrende Zahlung → Badge → dauerhafter Zugang.

| Aspekt | Detail |
|--------|--------|
| Badge | `membership-2025`, `membership-5year` |
| Issuer | Organisation-Pubkey |
| Prüfung | Beim Login / Content-Abruf |
| Ablauf | Im Identifier kodiert |

**Zeitmodelle:**
- `membership-2025` — Jahresmitgliedschaft
- `membership-5year-2025` — 5-Jahres-Badge ab 2025
- `lifetime-member` — Dauerhaft (Vorsicht: nicht revozierbar)

---

## Proof-of-Payment Flow

Das zentrale Muster für alle kostenpflichtigen Access-Badges:

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│   User   │────▶│   Payment    │────▶│  Badge wird  │────▶│  Zugang  │
│  zahlt   │     │  bestätigt   │     │  ausgestellt │     │  überall │
│(Lightning)│     │  (on-chain)  │     │  (kind 8)    │     │(kind 30008)│
└──────────┘     └──────────────┘     └──────────────┘     └──────────┘
```

### Detaillierter Ablauf

1. **User wählt Badge/Ticket/Membership** auf einer Plattform
2. **Lightning Invoice wird generiert** (oder anderes Zahlungsmittel)
3. **User zahlt**
4. **Payment-Service erkennt Zahlung** und kennt den User-Pubkey
5. **Badge wird automatisch awarded** (kind 8 Event auf Relays publiziert)
6. **User akzeptiert Badge** (aktualisiert kind 30008)
7. **Jede kompatible Plattform** erkennt den Badge beim Nostr-Login
8. **Kein erneutes Zahlen**, kein separates Account nötig

### Payment-to-Badge Automatisierung

Der kritische Baustein ist ein Service, der Zahlungen mit Badge-Vergabe verknüpft:

```python
# Pseudocode: Payment-to-Badge Service
async def on_payment_received(payment):
    user_pubkey = payment.metadata["nostr_pubkey"]
    badge_identifier = payment.metadata["badge_id"]

    await badge_service.award_badge(
        a_tag=f"30009:{issuer_pubkey}:{badge_identifier}",
        recipients=[user_pubkey]
    )
```

**Mögliche Implementierungen:**
- BadgeBox-Endpoint: `POST /api/v1/badges/payment-award`
- LNbits-Extension die bei Zahlung einen Badge awarded
- Standalone-Service mit Lightning-Node-Anbindung
- Webhook-basiert: Payment-Provider ruft Badge-Award-Endpoint auf

---

## Zeitbasierte Gültigkeit

Da NIP-58 Badges nicht revozierbar sind, wird Ablauf über den Identifier gelöst:

```
membership-2025        → Gültig für 2025
membership-q1-2025     → Gültig Q1 2025
event-2025-03-15       → Gültig für ein Datum
membership-5year-2025  → Gültig 2025-2029
lifetime-member        → Unbegrenzt
```

**Prüflogik:**

```javascript
function isValidMembership(badgeTags, currentYear) {
  return badgeTags.some(tag =>
    tag[0] === 'a' &&
    tag[1].includes(`membership-${currentYear}`)
  );
}
```

Alte Badges bleiben als historischer Nachweis bestehen, werden aber nicht mehr als gültige Berechtigung akzeptiert.

---

## Vertrauensmodell

Das System basiert auf **Issuer-Trust**, nicht auf zentraler Autorität:

```
Plattform vertraut Issuer-Pubkey X
  → Akzeptiert alle Badges von X
  → Ignoriert Badges von unbekannten Issuern
```

**Trust-Ketten:**
- Einfach: Plattform kennt den Issuer-Pubkey direkt
- Föderiert: Mehrere Plattformen vertrauen demselben Issuer
- Hierarchisch: Dach-Organisation zertifiziert Issuer (Badge-für-Badge)

**Beispiel: Föderiertes Membership**

Ein Verein vergibt Membership-Badges. Drei verschiedene Websites vertrauen dem Vereins-Pubkey. Mitglieder zahlen einmal und haben Zugang zu allen drei Seiten.

---

## Vorteile gegenüber klassischen Lösungen

| Klassisch | Badge-basiert |
|-----------|---------------|
| OAuth + Session-Cookies | Badge-Verifikation bei jedem Request |
| Zentrale User-Datenbank | Dezentral auf Relays |
| Plattform-Lock-in | Portabel über alle Nostr-Clients |
| Separate Accounts pro Service | Ein Nostr-Key, überall gültig |
| Payment-Provider speichert Kundendaten | Pseudonym, nur Pubkey sichtbar |
| Revocation-Listen pflegen | Zeitbasierte Badges laufen aus |
| API-Keys / JWT verwalten | Badge ist der Token |

---

## Offene Fragen & Herausforderungen

### Nicht-Revozierbarkeit

Badges können vom Issuer nicht zurückgezogen werden. Lösungsansätze:
- **Zeitbasierte Badges** — Natürlicher Ablauf
- **Blocklist auf Plattform-Ebene** — Einzelne Pubkeys sperren (Notlösung)
- **NIP-09 Deletion** — Issuer löscht den Award-Event (Relay-abhängig, kein Garantie)
- **Akzeptanz:** Für die meisten Use Cases (Events, Jahres-Memberships) ist Nicht-Revozierbarkeit kein Problem

### Privacy

- Badge-Akzeptanz ist öffentlich (kind 30008 ist auf Relays sichtbar)
- Jeder kann sehen, welche Memberships/Tickets ein User hält
- Lösungsansatz: User akzeptiert Badge nur temporär und entfernt ihn nach Zugangs-Prüfung
- Langfristig: NIP-Vorschlag für private Badge-Verifikation (Zero-Knowledge Proof?)

### UX für Nicht-Nostr-User

- Nostr-Key-Management ist für Mainstream-User noch zu komplex
- Lösungsansatz: Custodial Key-Management als Onboarding-Brücke
- NIP-46 (Remote Signing) vereinfacht den Flow über Mobile-Apps

### Offline-Verifikation

- Badge-Prüfung braucht aktuell Relay-Zugang
- Für physische Events: Cached Badge-Status oder signierte Offline-Tokens
- QR-Code mit signiertem Badge-Nachweis als Offline-Fallback

---

## Nächste Schritte

1. **Payment-to-Badge Flow** implementieren (Lightning → automatischer Badge-Award)
2. **Access-Check Middleware** als wiederverwendbare Library bauen
3. **Proof-of-Concept** mit einem konkreten Use Case (z.B. Badge-gated Content)
4. **QR-Code Badge-Verifikation** für physische Events prototypen
5. **Dokumentation** für Drittanbieter-Integration (wie prüfe ich Badges in meiner App?)

---

## Fazit

NIP-58 Badges als Access-Token sind keine neue Infrastruktur — sie sind eine neue Perspektive auf bestehende Infrastruktur. Die Technik existiert, die Verifikation ist trivial, und der dezentrale Charakter löst Probleme, die zentrale Systeme seit Jahren haben.

Der fehlende Baustein ist die Automatisierung: Payment rein → Badge raus → Zugang überall.
