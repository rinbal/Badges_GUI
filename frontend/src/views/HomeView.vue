<template>
  <div class="home">
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">Nostr Badges</h1>
        <p class="hero-subtitle">
          Create, award, and collect badges on the decentralized Nostr network.
          No databases, no middlemen — just cryptographic proof.
        </p>

        <div class="hero-actions">
          <router-link to="/creator" class="btn btn-primary btn-lg">
            <Icon name="sparkles" size="md" />
            <span>Create Badges</span>
          </router-link>
          <router-link to="/inbox" class="btn btn-secondary btn-lg">
            <Icon name="inbox" size="md" />
            <span>My Inbox</span>
          </router-link>
        </div>
      </div>
    </section>

    <section class="features">
      <div class="feature-card">
        <div class="feature-icon">
          <Icon name="edit" size="lg" />
        </div>
        <h3>Create</h3>
        <p>Design custom badges and publish them to the Nostr network</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">
          <Icon name="send" size="lg" />
        </div>
        <h3>Award</h3>
        <p>Award badges to any Nostr user by their public key</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">
          <Icon name="check-circle" size="lg" />
        </div>
        <h3>Accept</h3>
        <p>Accept badges and display them on your Nostr profile</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">
          <Icon name="shield" size="lg" />
        </div>
        <h3>Secure</h3>
        <p>Everything is cryptographically signed and verifiable</p>
      </div>
    </section>
    
    <section class="nip-info">
      <h2>Powered by NIP-58</h2>
      <p>
        This application implements the 
        <a href="https://github.com/nostr-protocol/nips/blob/master/58.md" target="_blank">
          NIP-58 Badges specification
        </a>
        for the Nostr protocol.
      </p>
      <div class="event-types">
        <div class="event-type">
          <code>kind: 30009</code>
          <span>Badge Definition</span>
        </div>
        <div class="event-type">
          <code>kind: 8</code>
          <span>Badge Award</span>
        </div>
        <div class="event-type">
          <code>kind: 30008</code>
          <span>Profile Badges</span>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="home-footer">
      <p class="footer-line">
        Built by
        <a href="https://github.com/rinbal" target="_blank" rel="noopener">rinbal</a>
        &
        <a href="https://github.com/DoktorShift" target="_blank" rel="noopener">DrShift</a>
      </p>
      <p class="footer-line footer-secondary">
        Payment infrastructure by
        <a href="https://aurorapay.me" target="_blank" rel="noopener">AuroraPay</a>
      </p>
    </footer>
  </div>
</template>

<script setup>
import Icon from '@/components/common/Icon.vue'
</script>

<style scoped>
.home {
  max-width: 900px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 1rem 0;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--color-text-muted);
  max-width: 600px;
  margin: 0 auto 2rem auto;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-lg);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 2rem 0;
}

.feature-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
}

.feature-card:hover {
  border-color: var(--color-primary-soft);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.feature-card:hover .feature-icon {
  color: var(--color-primary);
}

.feature-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: var(--color-text-muted);
  transition: color 0.2s ease;
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.feature-card p {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

.nip-info {
  text-align: center;
  padding: 3rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-top: 2rem;
}

.nip-info h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1rem 0;
}

.nip-info > p {
  color: var(--color-text-muted);
  margin: 0 0 2rem 0;
}

.nip-info a {
  color: var(--color-primary);
  text-decoration: underline;
}

.event-types {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.event-type {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.event-type code {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-primary);
  font-weight: 600;
}

.event-type span {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* Footer */
.home-footer {
  margin-top: 4rem;
  padding: 2.5rem 0;
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.footer-line {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.footer-line a {
  color: var(--color-text);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-line a:hover {
  color: var(--color-primary);
}

.footer-secondary {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}
</style>

