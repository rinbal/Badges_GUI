<template>
  <div class="request-card-skeleton">
    <!-- Badge Section -->
    <div class="badge-section">
      <div class="skeleton badge-image"></div>
      <div class="badge-info">
        <div class="skeleton badge-name"></div>
        <div class="skeleton badge-hint"></div>
      </div>
    </div>

    <!-- Requester Section -->
    <div class="requester-section">
      <div class="skeleton avatar"></div>
      <div class="requester-info">
        <div class="skeleton requester-name"></div>
        <div class="skeleton request-time"></div>
      </div>
    </div>

    <!-- Message Section -->
    <div class="message-section">
      <div class="skeleton message-line"></div>
      <div class="skeleton message-line short"></div>
    </div>

    <!-- Actions Section -->
    <div class="actions-section">
      <div class="skeleton action-btn"></div>
      <div class="skeleton action-btn"></div>
    </div>
  </div>
</template>

<style scoped>
.request-card-skeleton {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
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

/* Badge Section */
.badge-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.badge-image {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.badge-info {
  flex: 1;
}

.badge-name {
  height: 18px;
  width: 140px;
  margin-bottom: 0.375rem;
}

.badge-hint {
  height: 12px;
  width: 80px;
}

/* Requester Section */
.requester-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.requester-info {
  flex: 1;
}

.requester-name {
  height: 14px;
  width: 120px;
  margin-bottom: 0.375rem;
}

.request-time {
  height: 12px;
  width: 60px;
}

/* Message Section */
.message-section {
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
}

.message-line {
  height: 14px;
  width: 100%;
  margin-bottom: 0.5rem;
}

.message-line.short {
  width: 70%;
  margin-bottom: 0;
}

/* Actions Section */
.actions-section {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.action-btn {
  flex: 1;
  height: 40px;
}
</style>
