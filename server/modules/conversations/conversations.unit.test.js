import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config();

const { default: prisma } = await import("../../config/prisma.js");
const conversationsService = await import("./conversations.service.js");

describe("conversationsService.deleteConversation", () => {
  let testUser;
  let otherUser;

  before(async () => {
    testUser = await prisma.user.create({
      data: {
        email: `test-conv-delete-${Date.now()}@flightone.test`,
        name: "Test Conv User",
        passwordHash: "hash123",
      },
    });

    otherUser = await prisma.user.create({
      data: {
        email: `test-conv-other-${Date.now()}@flightone.test`,
        name: "Other Conv User",
        passwordHash: "hash123",
      },
    });
  });

  after(async () => {
    if (testUser) {
      await prisma.message.deleteMany({
        where: { conversation: { userId: testUser.id } },
      });
      await prisma.conversation.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    if (otherUser) {
      await prisma.message.deleteMany({
        where: { conversation: { userId: otherUser.id } },
      });
      await prisma.conversation.deleteMany({
        where: { userId: otherUser.id },
      });
      await prisma.user.delete({ where: { id: otherUser.id } });
    }
  });

  it("deletes owned conversation and cascades message deletion", async () => {
    const conv = await conversationsService.createConversation(testUser.id, {
      title: "Trip to Tokyo",
    });

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: "USER",
        content: "Find flights to Tokyo",
      },
    });

    const res = await conversationsService.deleteConversation(testUser.id, conv.id);
    assert.deepEqual(res, { id: conv.id, deleted: true });

    const foundConv = await prisma.conversation.findUnique({
      where: { id: conv.id },
    });
    assert.equal(foundConv, null);

    const foundMessages = await prisma.message.findMany({
      where: { conversationId: conv.id },
    });
    assert.equal(foundMessages.length, 0);
  });

  it("throws 404 when deleting a conversation owned by another user", async () => {
    const conv = await conversationsService.createConversation(otherUser.id, {
      title: "Private Trip",
    });

    await assert.rejects(
      async () => {
        await conversationsService.deleteConversation(testUser.id, conv.id);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /Conversation not found/i);
        return true;
      },
    );

    // Clean up
    await conversationsService.deleteConversation(otherUser.id, conv.id);
  });
});
