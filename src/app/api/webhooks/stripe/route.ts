import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = 'force-dynamic';
// import Stripe from "stripe";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    // const signature = req.headers.get("stripe-signature");

    // Mock stripe event for prototype purposes
    const event = JSON.parse(payload); 
    
    // In production:
    // const event = stripe.webhooks.constructEvent(payload, signature!, endpointSecret);

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const subscription = event.data.object;
      
      await db.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        create: {
          organizationId: subscription.metadata.organizationId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        update: {
          stripePriceId: subscription.items.data[0].price.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      
      // Update Org plan based on price
      // await db.organization.update(...)
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Stripe Webhook Error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 400 });
  }
}
