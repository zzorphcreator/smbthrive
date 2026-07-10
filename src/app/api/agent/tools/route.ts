import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getMenu,
  getMenuInput,
  checkItem,
  checkItemInput,
  createOrder,
  createOrderInput,
  cancelOrder,
  cancelOrderInput,
  orderStatus,
  orderStatusInput,
} from "@/lib/agent/tools";

// HTTP surface for the voice bridge (and any other channel service).
// POST { tool, args } with header x-agent-secret: $AGENT_API_SECRET.

const tools = {
  get_menu: { input: getMenuInput, run: getMenu },
  check_item: { input: checkItemInput, run: checkItem },
  create_order: { input: createOrderInput, run: createOrder },
  cancel_order: { input: cancelOrderInput, run: cancelOrder },
  order_status: { input: orderStatusInput, run: orderStatus },
} as const;

const bodySchema = z.object({
  tool: z.enum(Object.keys(tools) as [keyof typeof tools]),
  args: z.unknown(),
});

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_API_SECRET;
  if (!secret || request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { ok: false, error: "expected { tool, args }" },
      { status: 400 },
    );
  }

  const tool = tools[body.data.tool];
  const args = tool.input.safeParse(body.data.args);
  if (!args.success) {
    return NextResponse.json(
      { ok: false, error: z.prettifyError(args.error) },
      { status: 400 },
    );
  }

  try {
    // Each tool validates its own input; the cast is safe because tool and
    // args come from the same entry.
    const result = await tool.run(args.data as never);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "tool failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
