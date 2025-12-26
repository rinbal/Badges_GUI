<template>
  <div class="badge-card-skeleton">
    <!-- Image Skeleton -->
    <div class="skeleton-image"></div>
    
    <!-- Content Skeleton -->
    <div class="skeleton-content">
      <div class="skeleton-title"></div>
      <div class="skeleton-description"></div>
      <div class="skeleton-description short"></div>
      
      <!-- Issuer Skeleton -->
      <div class="skeleton-issuer">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-issuer-info">
          <div class="skeleton-label"></div>
          <div class="skeleton-name"></div>
        </div>
      </div>
    </div>
    
    <!-- Actions Skeleton -->
    <div class="skeleton-actions">
      <div class="skeleton-button"></div>
    </div>
  </div>
</template>

<style scoped>
.badge-card-skeleton {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  gap: 1.25rem;
}

/* Shimmer animation */
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-image,
.skeleton-title,
.skeleton-description,
.skeleton-avatar,
.skeleton-label,
.skeleton-name,
.skeleton-button {
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-image {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-title {
  height: 1.25rem;
  width: 60%;
  border-radius: var(--radius-sm);
}

.skeleton-description {
  height: 0.875rem;
  width: 100%;
  border-radius: var(--radius-sm);
}

.skeleton-description.short {
  width: 75%;
}

.skeleton-issuer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.skeleton-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-issuer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.skeleton-label {
  height: 0.625rem;
  width: 50px;
  border-radius: var(--radius-sm);
}

.skeleton-name {
  height: 0.875rem;
  width: 80px;
  border-radius: var(--radius-sm);
}

.skeleton-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.skeleton-button {
  height: 2.25rem;
  width: 5rem;
  border-radius: var(--radius-md);
}

@media (max-width: 640px) {
  .badge-card-skeleton {
    flex-direction: column;
    align-items: center;
  }
  
  .skeleton-content {
    align-items: center;
  }
  
  .skeleton-title {
    width: 50%;
  }
  
  .skeleton-description {
    width: 80%;
  }
  
  .skeleton-issuer {
    justify-content: center;
  }
  
  .skeleton-actions {
    align-items: center;
    width: 100%;
  }
}
</style>

