declare namespace Express {
  export interface Request {
    requestId?: string;
    logger?: any; // Consider creating a more specific logger type
    user?: any; // Define a proper User type for authentication
  }
}
