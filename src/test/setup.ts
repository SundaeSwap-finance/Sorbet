import { installChromeMock, resetChromeMock } from "./chromeMock";

installChromeMock();

beforeEach(() => {
  resetChromeMock();
});
