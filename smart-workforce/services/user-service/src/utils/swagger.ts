import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, RequestHandler } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'User Service API', version: '1.0.0' },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJSDoc(options);

export default function setupSwagger(app: Express) {
  // swaggerUi.serve and swaggerUi.setup have types that sometimes
  // conflict with Express overloads; cast to RequestHandler to satisfy TS.
  const serve = swaggerUi.serve as unknown as RequestHandler;
  const setup = swaggerUi.setup(specs) as unknown as RequestHandler;
  app.use('/docs', serve, setup);
}
