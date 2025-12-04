# Backend Architecture

## Modüler Yapı

Backend modüler mimari ile tasarlanmıştır. Her domain kendi klasöründe izole edilmiştir.

## Klasör Yapısı

```
backend/
  modules/
    auth/              # Authentication modülü
      auth.controller.js
      auth.service.js
      auth.routes.js
    location/          # Location tracking modülü
    billing/           # Payment & subscription modülü
    group/             # Group management modülü
    analytics/         # Analytics modülü
    blog/              # Blog/Article modülü
    notifications/     # Notifications modülü
    dashboard/         # Dashboard modülü
    system/            # System management modülü
  core/
    database/
      models/          # Database modelleri
        user.model.js
        subscription.model.js
        location.model.js
        group.model.js
        article.model.js
        notification.model.js
        billing.model.js
        token.model.js
        verification.model.js
    middleware/        # Shared middleware
      auth.middleware.js
      rateLimiter.js
      requestLogger.js
      subscriptionCheck.js
    services/          # Shared services
      cache.service.js
      metrics.service.js
      validation.service.js
      security.service.js
  config/
    database.js        # Database configuration
  routes/
    index.js           # Main router
  server.js            # Server entry point
```

## Modül Yapısı

Her modül şu dosyalara sahiptir:
- `{module}.controller.js` - HTTP request handlers
- `{module}.service.js` - Business logic
- `{module}.routes.js` - Route definitions
- `{module}.model.js` (opsiyonel) - Module-specific models

## Core Components

### Database Models
Tüm database işlemleri modeller üzerinden yapılır. Modeller `core/database/models/` klasöründe bulunur.

### Middleware
Shared middleware'ler `core/middleware/` klasöründe bulunur:
- `auth.middleware.js` - Authentication middleware
- `rateLimiter.js` - Rate limiting
- `requestLogger.js` - Request logging
- `subscriptionCheck.js` - Subscription checks

### Services
Shared services `core/services/` klasöründe bulunur:
- `cache.service.js` - Caching service
- `metrics.service.js` - Metrics collection
- `validation.service.js` - Input validation
- `security.service.js` - Security utilities

## Dependency Flow

```
Routes → Controllers → Services → Models → Database
```

## Best Practices

1. Her modül kendi klasöründe izole edilmiştir
2. Business logic servislerde, HTTP handling controller'larda
3. Database işlemleri modeller üzerinden yapılır
4. Shared functionality core klasöründe
5. Her modül kendi route dosyasına sahiptir

