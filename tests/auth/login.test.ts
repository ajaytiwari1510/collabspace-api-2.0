import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";
import { hashPassword } from "../../src/utils/password.util.js";


describe("POST /api/auth/login", () => {

  it("should login successfully with valid credentials", async () => {
    const password = "Test@12345";

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name: "Login Test User",
      email: "login-test@example.com",
      passwordHash,
      authMethod: "email",
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body.message).toBe("Login successful");

    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.accessToken).toBeTruthy();

    expect(response.body.data.refreshToken).toBeUndefined();

    expect(response.headers["set-cookie"]).toBeDefined();

    const updatedUser = await User.findById(user._id);

    expect(updatedUser?.loginFailCount).toBe(0);
    expect(updatedUser?.lastLoginAt).toBeTruthy();
  });

  it("should reject login with non-existing email", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: "does-not-exist@example.com",
      password: "Test@12345",
    });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe("Invalid credentials");
  });

  it("should reject login with wrong password and increment failed attempts", async () => {
  const correctPassword = "Test@12345";
  const passwordHash = await hashPassword(correctPassword);

  const user = await User.create({
    name: "Wrong Password User",
    email: "wrong-password@example.com",
    passwordHash,
    authMethod: "email",
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: user.email,
      password: "Wrong@12345",
    });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe("Invalid credentials");

  const updatedUser = await User.findById(user._id);

  expect(updatedUser?.loginFailCount).toBe(1);
  });

  it("should lock the account after maximum failed login attempts", async () => {
  const correctPassword = "Test@12345";
  const passwordHash = await hashPassword(correctPassword);

  const user = await User.create({
    name: "Lockout Test User",
    email: "lockout@example.com",
    passwordHash,
    authMethod: "email",
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: "Wrong@12345",
      });
  }

  const updatedUser = await User.findById(user._id);

  expect(updatedUser?.loginFailCount).toBe(5);
  expect(updatedUser?.lockedUntil).toBeDefined();
  expect(updatedUser?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it("should reject login when the account is locked", async () => {
  const correctPassword = "Test@12345";
  const passwordHash = await hashPassword(correctPassword);

  const user = await User.create({
    name: "Locked User",
    email: "locked@example.com",
    passwordHash,
    authMethod: "email",
    loginFailCount: 5,
    lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: user.email,
      password: correctPassword,
    });

  expect(response.status).toBe(403);
  expect(response.body.message).toMatch(/Account locked/);
  });

  it("should reset failed login attempts after successful login", async () => {
  const password = "Test@12345";
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: "Reset Attempts User",
    email: "reset-attempts@example.com",
    passwordHash,
    authMethod: "email",
    loginFailCount: 3,
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: user.email,
      password,
    });

  expect(response.status).toBe(200);

  const updatedUser = await User.findById(user._id);

  expect(updatedUser?.loginFailCount).toBe(0);
  expect(updatedUser?.lockedUntil).toBeUndefined();
  expect(updatedUser?.lastLoginAt).toBeDefined();
  });

  it("should allow login after the account lock has expired", async () => {
  const password = "Test@12345";
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: "Expired Lock User",
    email: "expired-lock@example.com",
    passwordHash,
    authMethod: "email",
    loginFailCount: 5,
    lockedUntil: new Date(Date.now() - 1000),
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: user.email,
      password,
    });

  expect(response.status).toBe(200);

  const updatedUser = await User.findById(user._id);

  expect(updatedUser?.loginFailCount).toBe(0);
  expect(updatedUser?.lockedUntil).toBeUndefined();
  expect(updatedUser?.lastLoginAt).toBeDefined();
  });
});