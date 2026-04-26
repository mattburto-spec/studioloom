/**
 * Tap-a-word sandbox: deterministic in-memory definitions for unit tests
 * and dev runs.
 *
 * The route /api/student/word-lookup checks `process.env.RUN_E2E !== "1"`
 * and routes through this sandbox instead of calling Anthropic. Unit tests
 * therefore exercise the full route shape (auth, cache lookup, upsert,
 * response shape) without consuming the API key.
 *
 * Phase 1 ships ~30 design-vocab words with student-friendly definitions.
 * Unknown words return a marked sentinel so tests can distinguish "real
 * cached entry" from "sandbox fallback".
 *
 * Pure synchronous function. No imports, no I/O.
 */

export interface SandboxDefinition {
  definition: string;
  example: string;
}

const SANDBOX_DEFINITIONS: Record<string, SandboxDefinition> = {
  design: {
    definition: "A plan or drawing for making something on purpose.",
    example: "The chair started as a design on a piece of paper.",
  },
  sort: {
    definition: "To put things in order or into groups.",
    example: "Sort the LEGO bricks by colour before you build.",
  },
  prototype: {
    definition: "An early test version of an idea, often made quickly.",
    example: "She glued cardboard together to make a prototype of the box.",
  },
  iterate: {
    definition: "To try, learn, change, and try again.",
    example: "Designers iterate by testing each version with real people.",
  },
  sketch: {
    definition: "A quick rough drawing showing the main idea.",
    example: "Make three sketches before you choose your favourite.",
  },
  model: {
    definition: "A small or simple version of something real.",
    example: "The 3D model showed how the bridge would carry weight.",
  },
  plan: {
    definition: "A set of steps you decide on before you start.",
    example: "Write a plan so you don't forget any materials.",
  },
  idea: {
    definition: "A thought about something you could make or do.",
    example: "Sticky notes are a good place to put every idea.",
  },
  feedback: {
    definition: "What other people tell you about your work.",
    example: "Useful feedback is specific, kind, and helpful.",
  },
  evaluate: {
    definition: "To judge how well something works.",
    example: "Evaluate your prototype by asking, 'Did it solve the problem?'",
  },
  materials: {
    definition: "The stuff you make something out of.",
    example: "Choose materials that are strong but easy to cut.",
  },
  sustainable: {
    definition: "Made or done in a way that does not harm the planet.",
    example: "Bamboo is a sustainable material because it grows back fast.",
  },
  ergonomics: {
    definition: "Designing things to fit human bodies safely and comfortably.",
    example: "Good ergonomics in a chair stops your back from aching.",
  },
  function: {
    definition: "What a thing is meant to do.",
    example: "The function of a kettle is to boil water.",
  },
  form: {
    definition: "The shape of something.",
    example: "The form of the bottle helps you hold it without slipping.",
  },
  user: {
    definition: "The person who will use the thing you design.",
    example: "Ask the user what they wish was different.",
  },
  brief: {
    definition: "A short description of what you are asked to design.",
    example: "Read the brief carefully before you start sketching.",
  },
  criteria: {
    definition: "A list of what your design must do.",
    example: "Check each idea against your criteria.",
  },
  constraint: {
    definition: "A limit or rule you must work inside.",
    example: "A budget of $5 is a constraint on what materials you can buy.",
  },
  solution: {
    definition: "A way of solving a problem.",
    example: "Three different solutions might all work — pick the simplest.",
  },
  problem: {
    definition: "Something that needs to be fixed or improved.",
    example: "The problem was that the lid kept falling off.",
  },
  research: {
    definition: "Looking up information to learn before you decide.",
    example: "Do research on what already exists before inventing something new.",
  },
  develop: {
    definition: "To grow an idea into something more finished.",
    example: "Develop your sketch by adding measurements and labels.",
  },
  refine: {
    definition: "To make small improvements until it is just right.",
    example: "Refine the handle so it fits a smaller hand.",
  },
  test: {
    definition: "To try something out and see if it works.",
    example: "Test your bridge by adding weights one at a time.",
  },
  present: {
    definition: "To show your work and explain it to others.",
    example: "Present your design with clear pictures and short labels.",
  },
  communicate: {
    definition: "To share information so others understand.",
    example: "Diagrams communicate ideas faster than long sentences.",
  },
  reflect: {
    definition: "To think back about what you did and what you learned.",
    example: "Reflect on the test: what would you change next time?",
  },
  document: {
    definition: "To write down or show what you did and why.",
    example: "Document each version with a photo and a sentence.",
  },
  draft: {
    definition: "An early version of something, not yet finished.",
    example: "This is a first draft — feedback will help me improve it.",
  },
};

/**
 * Look up a word in the sandbox dictionary.
 * Unknown words return a marked sentinel that tests can detect.
 */
export function lookupSandbox(word: string): SandboxDefinition {
  const key = word.toLowerCase();
  const known = SANDBOX_DEFINITIONS[key];
  if (known) return known;
  return {
    definition: `[sandbox] definition of "${word}"`,
    example: `[sandbox] example using "${word}".`,
  };
}
