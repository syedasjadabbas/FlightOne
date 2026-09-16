# FlightOne API — directory layout

Same conventions as `crm-server`. New features get a new `modules/<domain>/` folder.

```
flight-one-server/
├── app.js                      # HTTP bootstrap: middleware, mount routers, error handler
├── package.json                # "type": "module"
├── config/
│   └── prisma.js               # PrismaClient singleton + pool URL tweaks
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── middlewares/
│   ├── auth.js                 # requireAuth / optionalAuth
│   ├── rateLimit.js
│   ├── requestTiming.js
│   └── compression.js
├── lib/                        # Shared helpers (never route-specific)
│   ├── logger.js
│   ├── customError.js
│   ├── response.js
│   ├── utils.js
│   ├── validate.js
│   ├── jwt.js
│   ├── password.js
│   ├── crypto.js
│   ├── expires.js
│   └── request-context.js
├── modules/                    # one folder per domain
│   └── auth/
│       ├── index.js            # re-export router
│       ├── auth.routes.js
│       ├── auth.controller.js  # thin: parse req, call service, respond
│       ├── auth.service.js     # business logic + Prisma
│       └── auth.validators.js  # Zod schemas
├── docker-compose.yml
├── ecosystem.config.cjs
└── docs/
```

**Rules**
1. Routes never talk to Prisma — only **services** do.
2. Controllers call services and use `successResponse` / `next(e)`.
3. Services throw `AppError`; return plain data (no `res`).
4. Uniform envelope: `{ success, message, data }`.
5. Zod validation on the route boundary via `validateBody` / `validateQuery`.
6. Versioned API prefix: `/api/v1`.
