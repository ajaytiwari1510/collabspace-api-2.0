import { College } from "../models/college.model.js";

export const searchColleges = async (query: string) => {
  const colleges = await College.find({
    name: { $regex: query, $options: "i" },
  })
    .limit(10)
    .select("name city state isVerified");

  return colleges;
};