<template>
  <!--
    CollectionBadgeSkeleton
    Loading skeleton for collection grid cards.
    Matches the layout of CollectionBadgeCard.
  -->
  <div class="skeleton-card">
    <div class="skel-image"></div>
    <div class="skel-body">
      <div class="skel-line title"></div>
      <div class="skel-issuer">
        <div class="skel-avatar"></div>
        <div class="skel-line name"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.skel-image {
  aspect-ratio: 1;
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-body {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skel-line {
  height: 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-line.title {
  width: 75%;
  height: 14px;
}

.skel-line.name {
  width: 60px;
}

.skel-issuer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.skel-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-surface-elevated);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
