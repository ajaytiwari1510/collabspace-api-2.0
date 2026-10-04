import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../../src/app.js";
import { User } from "../../src/models/user.model.js";

describe("POST /api/auth/register", () => {

  it("should register a new user successfully", async () => {
    const userData = {
      name: "Test User",
      email: "register-test@example.com",
      password: "Test@12345",
    };

    const response = await request(app)
      .post("/api/auth/register")
      .send(userData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("success", true);

    const user = await User.findOne({
      email: userData.email,
    }).select("+passwordHash");

    expect(user).not.toBeNull();
    expect(user?.name).toBe(userData.name);
    expect(user?.email).toBe(userData.email);
    expect(user?.passwordHash).not.toBe(userData.password);
  });

  it("should reject registration with an already registered email", async () => {
    const userData = {
      name: "First User",
      email: "duplicate-test@example.com",
      password: "Test@12345",
    };

    await request(app)
      .post("/api/auth/register")
      .send(userData);

    const response = await request(app)
      .post("/api/auth/register")
      .send(userData);

    expect(response.status).toBe(400);

    const users = await User.find({
      email: userData.email,
    });

    expect(users).toHaveLength(1);
  });

  it("should reject registration with an invalid email", async () => {
  const userData = {
    name: "Invalid Email User",
    email: "invalid-email",
    password: "Test@12345",
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send(userData);

  expect(response.status).toBe(400);

  const user = await User.findOne({
    email: userData.email,
  });

  expect(user).toBeNull();
  });

  it("should reject registration with a password shorter than 8 characters", async () => {
  const userData = {
    name: "Short Password User",
    email: "short-password@example.com",
    password: "Test1",
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send(userData);

  expect(response.status).toBe(400);

  const user = await User.findOne({
    email: userData.email,
  });

  expect(user).toBeNull();
  });

  it("should reject registration when password is missing", async () => {
  const userData = {
    name: "Missing Password User",
    email: "missing-password@example.com",
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send(userData);

  expect(response.status).toBe(400);

  const user = await User.findOne({
    email: userData.email,
  });

  expect(user).toBeNull();
  });

  it("should reject registration when email is missing", async () => {
  const userData = {
    name: "Missing Email User",
    password: "Test@12345",
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send(userData);

  expect(response.status).toBe(400);

  const user = await User.findOne({
    name: userData.name,
  });

  expect(user).toBeNull();
  });

  it("should reject registration when name is shorter than 2 characters", async () => {
  const userData = {
    name: "A",
    email: "short-name@example.com",
    password: "Test@12345",
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send(userData);

  expect(response.status).toBe(400);

  const user = await User.findOne({
    email: userData.email,
  });

  expect(user).toBeNull();
  });

});