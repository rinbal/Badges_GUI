<template>
  <div class="badge-card-skeleton">
    <!-- Image -->
    <div class="skeleton badge-image"></div>

    <!-- Info -->
    <div class="badge-info">
      <div class="skeleton badge-name"></div>
      <div class="skeleton badge-desc"></div>
    </div>

    <!-- Meta -->
    <div class="badge-meta">
      <div class="skeleton issuer"></div>
      <div class="skeleton count"></div>
    </div>
  </div>
</template>

<style scoped>
.badge-card-skeleton {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.badge-image {
  width: 100%;
  aspect-ratio: 1;
}

.badge-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.badge-name {
  height: 18px;
  width: 80%;
}

.badge-desc {
  height: 14px;
  width: 60%;
}

.badge-meta {
  display: flex;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.issuer {
  height: 12px;
  width: 80px;
}

.count {
  height: 12px;
  width: 40px;
}
</style>
