import { createServer } from "@graphql-yoga/node";
import type { PrismaClient } from "@prisma/client";
import currencyFormatter from "currency-formatter";
import { readFileSync } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { join } from "path";
import { findOrCreateCart } from "../../lib/cart";
import { prisma } from "../../lib/prisma";
import { Resolvers } from "../../types";

export type GraphQLContext = {
  prisma: PrismaClient;
};

const currencyCode = "USD";

const typeDefs = readFileSync(join(process.cwd(), "schema.graphql"), "utf-8");

export async function createContext(): Promise<GraphQLContext> {
  return {
    prisma,
  };
}

const resolvers: Resolvers = {
  Query: {
    cart: async (_, { id }, { prisma }) => {
      return findOrCreateCart(prisma, id);
    },
  },
  Cart: {
    items: async ({ id }, _, { prisma }) => {
      return await prisma.cart
        .findUnique({
          where: {
            id,
          },
        })
        .items();
    },
    totalItems: async ({ id }, _, { prisma }) => {
      const items = await prisma.cart
        .findUnique({
          where: {
            id,
          },
        })
        .items();

      return items.reduce((acc, item) => acc + item.quantity || 1, 0);
    },
    subTotal: async ({ id }, _, { prisma }) => {
      const items = await prisma.cart
        .findUnique({
          where: {
            id,
          },
        })
        .items();

      const amount =
        items.reduce((acc, item) => acc + item.price * item.quantity || 0, 0) ??
        0;

      return {
        formatted: currencyFormatter.format(amount, { code: currencyCode }),
        amount,
      };
    },
  },
  CartItem: {
    unitPrice: item => {
      return {
        formatted: currencyFormatter.format(item.price, { code: currencyCode }),
        amount: item.price,
      };
    },
    totalPrice: item => {
      return {
        formatted: currencyFormatter.format(item.price * item.quantity, {
          code: currencyCode,
        }),
        amount: item.price * item.quantity,
      };
    }
  },
  Mutation: {
    addItem: async (_, { input }, { prisma }) => {
      const cart = await findOrCreateCart(prisma, input.cartID);

      await prisma.cartItem.upsert({
        create: {
          cartId: cart.id,
          id: input.id,
          name: input.name,
          description: input.description,
          image: input.image,
          price: input.price,
          quantity: input.quantity || 1,
        },
        update: {
          quantity: {
            increment: input.quantity || 1,
          },
        },
        where: {
          id_cartId: {
            id: input.id,
            cartId: cart.id,
          },
        },
      });

      return cart;
    },
  },
};

const server = createServer<{
  req: NextApiRequest;
  res: NextApiResponse;
}>({
  endpoint: "/api",
  schema: {
    typeDefs,
    resolvers,
  },
  context: createContext,
});

export default server;
