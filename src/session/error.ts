import AppError from "@/utils/error_handling/AppError";

export class AlreadyHavePartner extends AppError {
  constructor() {
    super({ message: `User is already partnered` });
  }
}
