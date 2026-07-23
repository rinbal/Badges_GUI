<template>
  <div class="about">
    <!-- Hero -->
    <section class="about-hero">
      <p class="eyebrow">About BadgeBox</p>
      <h1 class="hero-title">Verifiable badges, finally yours.</h1>
      <p class="hero-lede">
        BadgeBox is an open tool for creating, awarding, and collecting badges on Nostr.
        No databases, no middlemen - just cryptographic proof that anyone can verify.
      </p>
      <div class="hero-actions">
        <router-link to="/surf" class="btn btn-primary">
          Browse badges <Icon name="arrow-right" size="sm" />
        </router-link>
        <router-link to="/creator" class="btn btn-ghost">
          <Icon name="sparkles" size="sm" /> Create a badge
        </router-link>
      </div>
    </section>

    <!-- Mission -->
    <section class="about-section">
      <p class="eyebrow">Our mission</p>
      <p class="mission-statement">
        Recognition should belong to the people who earn it, not to a platform that can
        revoke it. BadgeBox turns a badge into something you truly own - signed with your
        keys, stored on open relays, and verifiable by anyone, for good.
      </p>
      <p class="mission-note">
        Built on NIP-58, the open Nostr standard for badges.
      </p>
    </section>

    <!-- Principles -->
    <section class="about-section principles">
      <p class="eyebrow">What we believe</p>
      <h2 class="section-title">A few simple beliefs.</h2>
      <div class="value-grid">
        <div v-for="v in values" :key="v.title" class="value-card">
          <span class="value-icon" :class="v.tone">
            <Icon :name="v.icon" size="md" />
          </span>
          <h3>{{ v.title }}</h3>
          <p>{{ v.body }}</p>
        </div>
      </div>
    </section>

    <!-- Open standards -->
    <div class="about-protocol">
      <ProtocolStandards />
    </div>

    <!-- The maker -->
    <section class="about-section">
      <p class="eyebrow">The maker</p>
      <h2 class="section-title">Built in the open.</h2>
      <div class="maker-grid">
        <article v-for="person in team" :key="person.handle" class="maker-card">
          <div class="maker-head">
            <div class="maker-avatar"><Icon name="award" size="md" /></div>
            <div class="maker-id">
              <h3>{{ person.name }}</h3>
              <p class="maker-role">{{ person.role }}</p>
            </div>
          </div>
          <p class="maker-blurb">{{ person.blurb }}</p>
          <div class="maker-links">
            <a
              v-for="link in person.links"
              :key="link.label"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="maker-link"
            >
              <Icon :name="link.icon" size="xs" />
              {{ link.label }}
            </a>
          </div>
        </article>
      </div>
    </section>

    <!-- Support closer -->
    <section class="about-support">
      <h2>Like what BadgeBox does?</h2>
      <p>BadgeBox is free and open source. A zap keeps the badges shipping.</p>
      <div class="support-actions">
        <a :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer" class="btn btn-outline">
          <Icon name="zap" size="sm" /> Support on Nostr
        </a>
        <router-link to="/" class="btn btn-ghost">
          Back to BadgeBox
        </router-link>
      </div>
    </section>

    <!-- Footer line -->
    <footer class="about-footer">
      <span>Built on Nostr. Your keys, your badges.</span>
      <AppVersion class="about-version" />
    </footer>
  </div>
</template>

<script setup>
import Icon from '@/components/common/Icon.vue'
import ProtocolStandards from '@/components/badges/ProtocolStandards.vue'
import AppVersion from '@/components/common/AppVersion.vue'
import { ADMIN_NPUB } from '@/config/chat'

const SUPPORT_URL = `https://primal.net/p/${ADMIN_NPUB}`

const values = [
  {
    icon: 'certificate',
    tone: 'tone-blue',
    title: 'Publicly verifiable',
    body: 'Every badge is a signed Nostr event. Anyone can check who issued it and who holds it, with no trusted third party and no closed database.'
  },
  {
    icon: 'key',
    tone: 'tone-green',
    title: 'Yours to keep',
    body: 'Badges live under your own keys on open relays. Show them off, carry them between apps, and keep them even if any single service disappears.'
  },
  {
    icon: 'globe',
    tone: 'tone-purple',
    title: 'Open and decentralized',
    body: 'BadgeBox runs on Nostr, a public protocol no company controls. Your identity and your badges move with you.'
  }
]

const team = [
  {
    name: 'Rinball',
    handle: 'rinbal',
    role: 'BadgeBox developer',
    blurb:
      'Rinball builds BadgeBox, an open source badge tool for the Nostr ecosystem, focused on making verifiable recognition simple, self-custodial, and genuinely fun to use.',
    links: [
      { icon: 'external-link', label: 'GitHub', href: 'https://github.com/rinbal' },
      { icon: 'user', label: 'Nostr', href: `https://primal.net/p/${ADMIN_NPUB}` }
    ]
  }
]
</script>

<style scoped>
.about {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem 0 4rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary);
  letter-spacing: 0.02em;
}

.section-title {
  margin: 0.5rem 0 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Hero */
.about-hero {
  text-align: center;
  padding: 3rem 1rem 2.5rem;
}

.about-hero .eyebrow {
  margin-bottom: 0.75rem;
}

.hero-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.hero-lede {
  max-width: 42rem;
  margin: 1.25rem auto 0;
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 2rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.375rem;
  border-radius: var(--radius-full);
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-ghost {
  background: transparent;
  color: var(--color-primary);
}

.btn-ghost:hover {
  background: var(--color-primary-soft);
}

.btn-outline {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-outline:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Sections */
.about-section {
  padding: 2.5rem 1rem;
  border-top: 1px solid var(--color-border);
}

.about-protocol {
  padding: 2.5rem 1rem 0;
}

.mission-statement {
  max-width: 46rem;
  margin: 1rem 0 0;
  font-size: clamp(1.25rem, 2.6vw, 1.75rem);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.mission-note {
  margin: 1.25rem 0 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}

/* Principles */
.value-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 2rem;
}

.value-card {
  padding: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.value-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.value-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
}

.tone-blue { background: rgba(6, 182, 212, 0.14); color: #06b6d4; }
.tone-green { background: rgba(34, 197, 94, 0.14); color: var(--color-success); }
.tone-purple { background: var(--color-primary-soft); color: var(--color-primary); }

.value-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.value-card p {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

/* Maker */
.maker-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  margin-top: 2rem;
}

.maker-card {
  padding: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.maker-head {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.maker-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  flex-shrink: 0;
}

.maker-id h3 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-text);
}

.maker-role {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-primary);
}

.maker-blurb {
  margin: 1rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.maker-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.maker-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
}

.maker-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Support closer */
.about-support {
  margin: 3rem 1rem 0;
  padding: 2.5rem 1.5rem;
  text-align: center;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.about-support h2 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--color-text);
}

.about-support p {
  max-width: 30rem;
  margin: 0.625rem auto 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}

.support-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1.5rem;
}

/* Footer */
.about-footer {
  margin-top: 2.5rem;
  padding: 1.5rem 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 640px) {
  .value-grid {
    grid-template-columns: 1fr;
  }
}
</style>
