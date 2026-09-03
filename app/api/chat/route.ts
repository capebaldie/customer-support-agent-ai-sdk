import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  tool,
  isStepCount,
} from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export async function POST(req: Request) {
  // message variable contains history of the chat
  const { messages }: { messages: UIMessage[] } = await req.json();

  // streamtext for showing response as streaming
  // there is generateText if dont want to stream the response
  const result = streamText({
    model: google("gemini-3.5-flash"),
    timeout: 10000,
    maxRetries: 5,
    maxOutputTokens: 512,
    reasoning: "low",
    // no of steps before that can run before generating final response
    stopWhen: isStepCount(5),
    messages: await convertToModelMessages(messages),
    tools: {
      getWeather: tool({
        description: "Get the weather in a location (fahrenheit)",
        inputSchema: z.object({
          location: z.string().describe("the location to get the weather for"),
        }),
        execute: async ({ location }) => {
          const temperature = Math.round(Math.random() * (90 - 32) + 32);
          const output = `${temperature} degree`;
          return {
            location,
            output,
          };
        },
      }),
      convertFahrenheitToCelsius: tool({
        description: "Convert a temperature in fahrenheit to celsius",
        inputSchema: z.object({
          temperature: z
            .number()
            .describe("The temperature in fahrenheit to convert"),
        }),
        execute: async ({ temperature }) => {
          const celsius = Math.round((temperature - 32) * (5 / 9));
          return {
            celsius,
          };
        },
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
