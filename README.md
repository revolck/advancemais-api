# AdvanceMais API

Backend API for the Advance+ platform. Provides authentication, company plans, job vacancies,
payment integrations and website content management.

## Running locally

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env` and fill in required values
3. Generate Prisma client: `pnpm run prisma:generate`
4. Start the dev server: `pnpm run dev`

## API documentation

The API exposes an OpenAPI specification with two documentation UIs:

- **Swagger UI** – `GET /api-docs`
- **ReDoc** – `GET /redoc`
- **Raw spec** – `GET /docs.json`

All documentation endpoints require an admin token obtained via the login flow. Include
`Authorization: Bearer <token>` in requests or use the built-in cookie auth in Swagger.

## Main modules

| Tag                 | Description                                          |
|---------------------|------------------------------------------------------|
| Usuarios            | User registration, login and profile operations      |
| MercadoPago         | Payment flows for subscriptions and checkout         |
| Empresa / PlanoEmpresa | Company plans and vacancy limits                   |
| Vagas               | Job vacancies and candidate applications             |
| Website             | Public website content management                    |

Additional tags cover specific website sections such as banners, sliders and
informational pages. Consult the Swagger or ReDoc documentation for detailed
schemas and request/response examples.

## Building & testing

- Lint & unit tests: `pnpm test`
- Build for production: `pnpm run build`

