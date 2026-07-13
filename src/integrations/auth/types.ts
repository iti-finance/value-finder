export type AuthTokenPayload = {
  userId: string;
  role: "admin" | "branch";
  employeeCode: string;
  fullName: string;
  iat?: number;
  exp?: number;
};
