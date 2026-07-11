import { describe, it, expect, vi, beforeEach } from "vitest";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";

// Use vi.hoisted to declare and share mocks
const mocks = vi.hoisted(() => {
  const mockSocket = {
    id: "socket-123",
    emit: vi.fn(),
    on: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
  };

  const mockNamespace = {
    on: vi.fn().mockImplementation((event, callback) => {
      if (event === "connection") {
        callback(mockSocket);
      }
    }),
    emit: vi.fn(),
    to: vi.fn().mockReturnThis(),
  };

  const mockServer = vi.fn().mockImplementation(() => {
    return {
      of: vi.fn().mockReturnValue(mockNamespace),
    };
  });

  return {
    mockSocket,
    mockNamespace,
    mockServer,
  };
});

vi.mock("socket.io", () => {
  return {
    Server: mocks.mockServer,
  };
});

vi.mock("@/infrastructure/logger/pino", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SocketGateway Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketGateway["io"] = null; // Reset singleton instance server
  });

  it("should initialize Socket.io Server and configure namespace connection", () => {
    const mockHttpServer = {};
    socketGateway.initialize(mockHttpServer);

    expect(socketGateway["io"]).toBeDefined();
    expect(mocks.mockServer).toHaveBeenCalled();
  });

  it("should handle incident subscription and heartbeat commands", () => {
    const mockHttpServer = {};
    
    // Capture the register functions attached to socket.on
    const registeredHandlers: Record<string, Function> = {};
    mocks.mockSocket.on.mockImplementation((event: string, callback: Function) => {
      registeredHandlers[event] = callback;
    });

    socketGateway.initialize(mockHttpServer);

    // 1. Verify "subscribe:incident" room join logic
    const subscribeHandler = registeredHandlers["subscribe:incident"];
    expect(subscribeHandler).toBeDefined();

    subscribeHandler("INC-123");
    expect(mocks.mockSocket.join).toHaveBeenCalledWith("incident:INC-123");
    expect(mocks.mockSocket.emit).toHaveBeenCalledWith("subscribed", { room: "incident:INC-123" });

    // 2. Verify "heartbeat" feedback mechanism
    const heartbeatHandler = registeredHandlers["heartbeat"];
    expect(heartbeatHandler).toBeDefined();

    heartbeatHandler({ tick: 1 });
    expect(mocks.mockSocket.emit).toHaveBeenCalledWith("heartbeat:ack", expect.objectContaining({
      status: "healthy",
    }));
  });

  it("should broadcast risk updates to namespace and target rooms", () => {
    const mockHttpServer = {};
    socketGateway.initialize(mockHttpServer);

    const mockAssessment = {
      id: "ra_99",
      incidentId: "INC-99",
      severity: "HIGH",
      priority: "HIGH",
      overallRiskScore: 72,
      confidence: 0.88,
      reasoning: "Test reasoning",
    };

    socketGateway.broadcastRiskUpdated("INC-99", mockAssessment);

    // Check broadcast sent to namespace and room
    expect(mocks.mockNamespace.emit).toHaveBeenCalledWith("risk:updated", expect.any(Object));
    expect(mocks.mockNamespace.to).toHaveBeenCalledWith("incident:INC-99");
  });
});
