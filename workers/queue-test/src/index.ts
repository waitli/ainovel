export default {
  async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext): Promise<void> {
    console.log(`[QUEUE-TEST] Received ${batch.messages.length} messages`);
    for (const msg of batch.messages) {
      console.log(`[QUEUE-TEST] Body: ${JSON.stringify(msg.body)}`);
      msg.ack();
    }
  },

  async fetch(request: Request): Promise<Response> {
    return new Response('queue-test alive');
  },
};
