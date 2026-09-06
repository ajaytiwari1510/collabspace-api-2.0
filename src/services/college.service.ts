import { College } from "../models/college.model.js";
import { escapeRegex } from "../utils/regex.util.js";

export const searchColleges = async (query: string) => {
  const colleges = await College.find({
    name: { $regex: escapeRegex(query), $options: "i" },
  })
    .limit(10)
    .select("name city state isVerified");

  return colleges;
};