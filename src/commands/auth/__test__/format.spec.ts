import { afterEach, expect, test, vi } from "vite-plus/test";

import {
  printAuthLoginSuccess,
  printProfileDeleteSuccess,
  printProfileDoctorReport,
  printProfileList,
  printProfileUseSuccess,
  printStoredProfile,
} from "../format.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockStdout() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

test("printAuthLoginSuccess writes json output when requested", () => {
  const stdoutSpy = mockStdout();

  printAuthLoginSuccess(
    {
      name: "local",
      baseUrl: "https://demo.halo.run",
      auth: {
        type: "bearer",
      },
    } as never,
    {
      user: {
        metadata: {
          name: "admin",
        },
        spec: {
          displayName: "Halo Admin",
        },
      },
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"profile": "local"');
  expect(output).toContain('"baseUrl": "https://demo.halo.run"');
  expect(output).toContain('"displayName": "Halo Admin"');
});

test("printAuthLoginSuccess writes a readable success message in text mode", () => {
  const stdoutSpy = mockStdout();

  printAuthLoginSuccess(
    {
      name: "local",
      baseUrl: "https://demo.halo.run",
      auth: {
        type: "bearer",
      },
    } as never,
    {
      user: {
        metadata: {
          name: "admin",
        },
        spec: {
          displayName: "Halo Admin",
        },
      },
    } as never,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "Logged in to https://demo.halo.run as Halo Admin using profile local.\n",
  );
});

test("printProfileList writes json output when requested", () => {
  const stdoutSpy = mockStdout();

  printProfileList(
    "local",
    [
      {
        name: "local",
        baseUrl: "https://demo.halo.run",
        auth: {
          type: "bearer",
        },
      },
    ] as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"activeProfile": "local"');
  expect(output).toContain('"name": "local"');
});

test("printProfileList renders configured profiles in table mode", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printProfileList("local", [
    {
      name: "local",
      baseUrl: "https://demo.halo.run",
      auth: {
        type: "bearer",
      },
    },
    {
      name: "staging",
      baseUrl: "https://staging.example.com",
      auth: {
        type: "basic",
      },
    },
  ] as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("NAME");
  expect(output).toContain("BASE URL");
  expect(output).toContain("AUTH");
  expect(output).toContain("ACTIVE");
  expect(output).toContain("local");
  expect(output).toContain("https://demo.halo.run");
  expect(output).toContain("bearer");
  expect(output).toContain("staging");
  expect(output).toContain("basic");
  expect(output).toContain("*");
});

test("printProfileList shows guidance when there are no profiles", () => {
  const stdoutSpy = mockStdout();

  printProfileList(undefined, []);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "No Halo profiles configured. Run `halo auth login` first.\n",
  );
});

test("printStoredProfile writes json output when requested", () => {
  const stdoutSpy = mockStdout();

  printStoredProfile(
    {
      name: "local",
      baseUrl: "https://demo.halo.run",
      auth: {
        type: "bearer",
      },
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"name": "local"');
  expect(output).toContain('"baseUrl": "https://demo.halo.run"');
});

test("printStoredProfile renders detail output in table mode", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    configurable: true,
  });

  printStoredProfile({
    name: "local",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "bearer",
    },
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain("FIELD");
  expect(output).toContain("VALUE");
  expect(output).toContain("name");
  expect(output).toContain("local");
  expect(output).toContain("baseUrl");
  expect(output).toContain("https://demo.halo.run");
  expect(output).toContain("auth.type");
  expect(output).toContain("bearer");
});

test("printProfileUseSuccess writes json output when requested", () => {
  const stdoutSpy = mockStdout();

  printProfileUseSuccess(
    {
      name: "local",
      baseUrl: "https://demo.halo.run",
      auth: {
        type: "bearer",
      },
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"activeProfile": "local"');
  expect(output).toContain('"name": "local"');
});

test("printProfileUseSuccess writes a plain text success message", () => {
  const stdoutSpy = mockStdout();

  printProfileUseSuccess({
    name: "local",
    baseUrl: "https://demo.halo.run",
    auth: {
      type: "bearer",
    },
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith("Active profile set to local.\n");
});

test("printProfileDeleteSuccess writes json output when requested", () => {
  const stdoutSpy = mockStdout();

  printProfileDeleteSuccess("local", "staging", true);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"deleted": true');
  expect(output).toContain('"name": "local"');
  expect(output).toContain('"activeProfile": "staging"');
});

test("printProfileDeleteSuccess reports remaining active profile in text mode", () => {
  const stdoutSpy = mockStdout();

  printProfileDeleteSuccess("local", "staging");

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "Deleted profile local and removed its saved credentials. Active profile remains staging.\n",
  );
});

test("printProfileDeleteSuccess reports when no active profile remains", () => {
  const stdoutSpy = mockStdout();

  printProfileDeleteSuccess("local", undefined);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "Deleted profile local and removed its saved credentials. No active profile is selected now.\n",
  );
});

test("printProfileDoctorReport writes json output when requested", () => {
  const stdoutSpy = mockStdout();

  printProfileDoctorReport(
    {
      ok: false,
      activeProfile: "local",
      profiles: [
        {
          name: "local",
          baseUrl: "https://demo.halo.run",
          authType: "bearer",
          status: "missing-credentials",
        },
      ],
    } as never,
    true,
  );

  expect(stdoutSpy).toHaveBeenCalledOnce();
  const output = String(stdoutSpy.mock.calls[0]?.[0]);
  expect(output).toContain('"ok": false');
  expect(output).toContain('"status": "missing-credentials"');
});

test("printProfileDoctorReport shows guidance when there are no profiles", () => {
  const stdoutSpy = mockStdout();

  printProfileDoctorReport({
    ok: true,
    activeProfile: undefined,
    profiles: [],
  } as never);

  expect(stdoutSpy).toHaveBeenCalledOnce();
  expect(stdoutSpy).toHaveBeenCalledWith(
    "No Halo profiles configured. Run `halo auth login` first.\n",
  );
});

test("printProfileDoctorReport renders issues in table mode", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printProfileDoctorReport({
    ok: false,
    activeProfile: "local",
    profiles: [
      {
        name: "local",
        baseUrl: "https://demo.halo.run",
        authType: "bearer",
        status: "missing-credentials",
      },
      {
        name: "staging",
        baseUrl: "https://staging.example.com",
        authType: "basic",
        status: "auth-type-mismatch",
      },
      {
        name: "prod",
        baseUrl: "https://example.com",
        authType: "bearer",
        status: "ok",
      },
    ],
  } as never);

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const messageOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("NAME");
  expect(tableOutput).toContain("BASE URL");
  expect(tableOutput).toContain("AUTH");
  expect(tableOutput).toContain("STATUS");
  expect(tableOutput).toContain("ACTIVE");
  expect(tableOutput).toContain("local");
  expect(tableOutput).toContain("missing credentials");
  expect(tableOutput).toContain("staging");
  expect(tableOutput).toContain("auth type mismatch");
  expect(tableOutput).toContain("prod");
  expect(tableOutput).toContain("ok");
  expect(tableOutput).toContain("*");

  expect(messageOutput).toContain("Profile credential issues detected.");
});

test("printProfileDoctorReport reports success when all profiles are healthy", () => {
  const stdoutSpy = mockStdout();

  Object.defineProperty(process.stdout, "columns", {
    value: 120,
    configurable: true,
  });

  printProfileDoctorReport({
    ok: true,
    activeProfile: "local",
    profiles: [
      {
        name: "local",
        baseUrl: "https://demo.halo.run",
        authType: "bearer",
        status: "ok",
      },
    ],
  } as never);

  expect(stdoutSpy).toHaveBeenCalledTimes(2);

  const tableOutput = String(stdoutSpy.mock.calls[0]?.[0]);
  const messageOutput = String(stdoutSpy.mock.calls[1]?.[0]);

  expect(tableOutput).toContain("local");
  expect(tableOutput).toContain("ok");
  expect(messageOutput).toBe("Profile credential check passed.\n");
});
