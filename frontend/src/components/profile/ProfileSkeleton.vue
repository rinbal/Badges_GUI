<template>
  <!--
    ProfileSkeleton
    Loading skeleton for the profile page.
    Shows placeholders for profile header and badges grid.
  -->
  <div class="profile-skeleton">
    <!-- Profile Header Skeleton -->
    <div class="header-skeleton">
      <div class="avatar-skeleton"></div>
      <div class="info-skeleton">
        <div class="skel-line name"></div>
        <div class="skel-line npub"></div>
        <div class="skel-line about"></div>
        <div class="skel-line about short"></div>
      </div>
    </div>

    <!-- Badges Section Skeleton -->
    <div class="badges-skeleton">
      <div class="skel-line section-title"></div>
      <div class="badges-grid-skeleton">
        <div v-for="n in 4" :key="n" class="badge-card-skeleton">
          <div class="skel-image"></div>
          <div class="skel-body">
            <div class="skel-line title"></div>
            <div class="skel-issuer">
              <div class="skel-avatar"></div>
              <div class="skel-line issuer-name"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-skeleton {
  max-width: 800px;
  margin: 0 auto;
}

/* Header Skeleton */
.header-skeleton {
  display: flex;
  gap: 2rem;
  padding: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  margin-bottom: 2rem;
}

.avatar-skeleton {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.info-skeleton {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

/* Skeleton Lines */
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

.skel-line.name {
  width: 180px;
  height: 24px;
}

.skel-line.npub {
  width: 280px;
  height: 14px;
}

.skel-line.about {
  width: 100%;
  max-width: 400px;
}

.skel-line.about.short {
  width: 60%;
}

.skel-line.section-title {
  width: 140px;
  height: 20px;
  margin-bottom: 1rem;
}

/* Badges Section Skeleton */
.badges-skeleton {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 2rem;
}

.badges-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

/* Badge Card Skeleton */
.badge-card-skeleton {
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

.skel-line.title {
  width: 75%;
  height: 14px;
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
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skel-line.issuer-name {
  width: 60px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Mobile */
@media (max-width: 640px) {
  .header-skeleton {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .info-skeleton {
    align-items: center;
  }

  .badges-grid-skeleton {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
