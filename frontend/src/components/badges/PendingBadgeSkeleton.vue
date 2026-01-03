<template>
  <!--
    PendingBadgeSkeleton
    Loading skeleton for pending badge cards.
    Matches the layout of PendingBadgeCard.
  -->
  <div class="skeleton-card">
    <div class="skel-image"></div>
    <div class="skel-content">
      <div class="skel-line title"></div>
      <div class="skel-line desc"></div>
      <div class="skel-issuer">
        <div class="skel-avatar"></div>
        <div class="skel-line name"></div>
      </div>
    </div>
    <div class="skel-actions">
      <div class="skel-button"></div>
      <div class="skel-button small"></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.skel-image {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  animation: shimmer 1.5s infinite;
}

.skel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skel-line {
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  animation: shimmer 1.5s infinite;
}

.skel-line.title {
  width: 60%;
  height: 16px;
}

.skel-line.desc {
  width: 80%;
}

.skel-line.name {
  width: 80px;
}

.skel-issuer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.skel-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-surface-elevated);
  animation: shimmer 1.5s infinite;
}

.skel-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skel-button {
  width: 80px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  animation: shimmer 1.5s infinite;
}

.skel-button.small {
  height: 32px;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>
