import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Firebase Admin configuration guarantees.
 *
 * No real credential is used anywhere in this file — every key is a throwaway
 * RSA pair generated in memory for the duration of a single test.
 */

/** Generate a structurally valid PKCS#8 PEM that firebase-admin will accept. */
const throwawayPem = (): string =>
  crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;

/** Store a PEM the way the service-account JSON does: one line, escaped \n. */
const asEnvValue = (pem: string): string => pem.replace(/\n/g, '\\n');

const VALID_ENV = () => ({
  FIREBASE_PROJECT_ID: 'solar-solution-495613-a6',
  FIREBASE_CLIENT_EMAIL: 'tution@solar-solution-495613-a6.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: asEnvValue(throwawayPem()),
});

const applyEnv = (vars: Record<string, string | undefined>) => {
  ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].forEach((k) => {
    delete process.env[k];
  });
  Object.entries(vars).forEach(([k, v]) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  });
};

/**
 * firebase.ts holds module-level state (the initialized app), so each test gets
 * a fresh module registry and a fresh firebase-admin instance.
 */
const loadFirebaseModule = () => {
  let mod: typeof import('../config/firebase');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('../config/firebase');
  });
  return mod!;
};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('Firebase Admin initialization', () => {
  it('initializes with valid environment variables and exposes messaging', () => {
    applyEnv(VALID_ENV());
    const fb = loadFirebaseModule();

    fb.initializeFirebase();

    expect(fb.isFirebaseReady()).toBe(true);
    expect(fb.getMessaging()).not.toBeNull();
  });

  it('converts escaped \\n into real newlines before handing the key to firebase-admin', () => {
    const pem = throwawayPem();
    const env = { ...VALID_ENV(), FIREBASE_PRIVATE_KEY: asEnvValue(pem) };

    // The stored value must be a single line with literal backslash-n.
    expect(env.FIREBASE_PRIVATE_KEY).toContain('\\n');
    expect(env.FIREBASE_PRIVATE_KEY.split('\n')).toHaveLength(1);

    applyEnv(env);
    const fb = loadFirebaseModule();
    fb.initializeFirebase();

    // Acceptance proves the unescaping happened — a literal "\n" PEM is invalid.
    expect(fb.isFirebaseReady()).toBe(true);
  });

  it('also accepts a key that already contains real newlines', () => {
    applyEnv({ ...VALID_ENV(), FIREBASE_PRIVATE_KEY: throwawayPem() });
    const fb = loadFirebaseModule();

    fb.initializeFirebase();

    expect(fb.isFirebaseReady()).toBe(true);
  });

  it('does not initialize twice', () => {
    applyEnv(VALID_ENV());
    const fb = loadFirebaseModule();

    fb.initializeFirebase();
    expect(fb.isFirebaseReady()).toBe(true);

    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    fb.initializeFirebase();
    fb.initializeFirebase();

    // The idempotency guard returns before logging or re-initializing.
    expect(log).not.toHaveBeenCalledWith('✅ Firebase Admin initialized successfully');
    expect(fb.isFirebaseReady()).toBe(true);
  });
});

describe('Firebase credential rejection', () => {
  const expectSkipped = (env: Record<string, string | undefined>) => {
    applyEnv(env);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fb = loadFirebaseModule();

    fb.initializeFirebase();

    expect(fb.isFirebaseReady()).toBe(false);
    expect(fb.getMessaging()).toBeNull();
    expect(warn).toHaveBeenCalled();
    return fb;
  };

  it('rejects the .env.example placeholder values', () => {
    const fb = expectSkipped({
      FIREBASE_PROJECT_ID: 'your-firebase-project-id',
      FIREBASE_CLIENT_EMAIL: 'your-firebase-client-email',
      FIREBASE_PRIVATE_KEY: 'your-firebase-private-key',
    });

    expect(fb.getFirebaseDiagnostics().reason).toMatch(/placeholder/i);
  });

  it('rejects generic placeholder words', () => {
    expectSkipped({ ...VALID_ENV(), FIREBASE_PROJECT_ID: 'placeholder' });
    expectSkipped({ ...VALID_ENV(), FIREBASE_CLIENT_EMAIL: 'CHANGEME' });
  });

  it('rejects a malformed / non-PEM private key', () => {
    const fb = expectSkipped({ ...VALID_ENV(), FIREBASE_PRIVATE_KEY: 'not-a-key-at-all' });

    expect(fb.getFirebaseDiagnostics().reason).toMatch(/PEM/i);
  });

  it('rejects a truncated PEM missing its END marker', () => {
    const truncated = throwawayPem().split('-----END PRIVATE KEY-----')[0];
    const fb = expectSkipped({ ...VALID_ENV(), FIREBASE_PRIVATE_KEY: truncated });

    expect(fb.getFirebaseDiagnostics().reason).toMatch(/PEM/i);
  });

  it('reports every missing variable by name', () => {
    applyEnv({});
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fb = loadFirebaseModule();

    fb.initializeFirebase();

    const reason = fb.getFirebaseDiagnostics().reason ?? '';
    expect(reason).toContain('FIREBASE_PROJECT_ID');
    expect(reason).toContain('FIREBASE_CLIENT_EMAIL');
    expect(reason).toContain('FIREBASE_PRIVATE_KEY');
  });

  it('does not throw when credentials are absent — the API must still boot', () => {
    applyEnv({});
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fb = loadFirebaseModule();

    expect(() => fb.initializeFirebase()).not.toThrow();
    expect(fb.isFirebaseReady()).toBe(false);
  });
});

describe('diagnostics never leak secrets', () => {
  it('reports presence flags only', () => {
    const env = VALID_ENV();
    applyEnv(env);
    const fb = loadFirebaseModule();
    fb.initializeFirebase();

    const d = fb.getFirebaseDiagnostics();

    expect(d).toMatchObject({
      configured: true,
      projectId: 'solar-solution-495613-a6',
      clientEmail: 'configured',
      privateKey: 'configured',
    });

    // The serialized diagnostic must contain no key material at all.
    const serialized = JSON.stringify(d);
    expect(serialized).not.toContain('BEGIN PRIVATE KEY');
    expect(serialized).not.toContain(env.FIREBASE_PRIVATE_KEY);
    expect(serialized).not.toContain(env.FIREBASE_CLIENT_EMAIL);
  });

  it('logFirebaseDiagnostics prints no key material', () => {
    const env = VALID_ENV();
    applyEnv(env);
    const lines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...a) => {
      lines.push(a.join(' '));
    });

    const fb = loadFirebaseModule();
    fb.initializeFirebase();
    fb.logFirebaseDiagnostics();

    const output = lines.join('\n');
    expect(output).toContain('configured:  true');
    expect(output).not.toContain('BEGIN PRIVATE KEY');
    expect(output).not.toContain(env.FIREBASE_PRIVATE_KEY);
  });

  it('does not print the key when firebase-admin rejects the credential', () => {
    // Structurally a PEM, but not a usable key — cert() will reject it.
    const bogus =
      '-----BEGIN PRIVATE KEY-----\\nQUJDREVGRw==\\n-----END PRIVATE KEY-----\\n';
    applyEnv({ ...VALID_ENV(), FIREBASE_PRIVATE_KEY: bogus });

    const errors: string[] = [];
    jest.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a.map(String).join(' '));
    });

    const fb = loadFirebaseModule();
    fb.initializeFirebase();

    expect(fb.isFirebaseReady()).toBe(false);
    const output = errors.join('\n');
    expect(output).not.toContain('QUJDREVGRw');
    expect(output).not.toContain('BEGIN PRIVATE KEY');
  });
});

describe('production entrypoint wiring', () => {
  const backendRoot = path.resolve(__dirname, '../..');

  it('PM2 runs the compiled TypeScript entrypoint, not the legacy server.js', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ecosystem = require(path.join(backendRoot, 'ecosystem.config.js'));
    const app = ecosystem.apps[0];

    expect(app.script).toBe('./dist/index.js');
    expect(app.script).not.toContain('server.js');
  });

  it('tsconfig emits the entrypoint PM2 expects', () => {
    const raw = fs.readFileSync(path.join(backendRoot, 'tsconfig.json'), 'utf8');
    const tsconfig = JSON.parse(raw.replace(/\/\/.*$/gm, ''));

    expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    expect(tsconfig.compilerOptions.rootDir).toBe('./src');
    // Tests must not ship in the production build.
    expect(tsconfig.exclude).toContain('src/__tests__');
  });

  it('no entrypoint claims Firebase success without initializing it', () => {
    ['server.js', 'server-production.js'].forEach((file) => {
      const source = fs.readFileSync(path.join(backendRoot, file), 'utf8');
      expect(source).not.toContain('🔥 Firebase initialized successfully');
    });
  });

  it('the real success message exists in exactly one module', () => {
    const source = fs.readFileSync(path.join(backendRoot, 'src/config/firebase.ts'), 'utf8');
    expect(source).toContain('✅ Firebase Admin initialized successfully');
  });

  it('deploy.sh builds TypeScript before starting PM2', () => {
    const deploy = fs.readFileSync(path.join(backendRoot, 'deploy.sh'), 'utf8');

    // The build must be active, not commented out.
    expect(deploy).toMatch(/^\s*npm run build\s*$/m);
    expect(deploy).toContain('dist/index.js');
    // devDependencies are needed for tsc.
    expect(deploy).toContain('--include=dev');
  });

  it('the notification router is mounted by the production route index', () => {
    const routes = fs.readFileSync(path.join(backendRoot, 'src/routes/index.ts'), 'utf8');
    expect(routes).toMatch(/router\.use\('\/notifications',\s*notificationRoutes\)/);
  });

  it('device-token endpoints are registered and authenticated', () => {
    const source = fs.readFileSync(path.join(backendRoot, 'src/routes/notifications.ts'), 'utf8');

    const post = source.match(/router\.post\('\/device-token'[^)]*\)/)?.[0] ?? '';
    const del = source.match(/router\.delete\('\/device-token'[^)]*\)/)?.[0] ?? '';

    expect(post).toContain('authenticate');
    expect(del).toContain('authenticate');
  });

  it('device-token handlers take the user from the session, never the body', () => {
    const source = fs.readFileSync(
      path.join(backendRoot, 'src/controllers/notificationController.ts'),
      'utf8',
    );

    const handlers = source.slice(source.indexOf('registerDeviceTokenHandler'));
    expect(handlers).toContain('req.user?._id');
    // A client-supplied userId must never be trusted.
    expect(handlers).not.toMatch(/req\.body[^;]*userId/);
  });
});
