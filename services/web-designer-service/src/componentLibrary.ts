export type ComponentCategory = 'hero' | 'features' | 'cta' | 'footer' | 'testimonial'

export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  html: string
  css?: string
  accessibilityNotes?: string[]
}

export const componentLibrary: ComponentDefinition[] = [
  {
    id: 'hero-centered',
    name: 'Centered Hero',
    category: 'hero',
    html: `
      <section class="hero hero--centered">
        <p class="eyebrow">AI-Powered Studio</p>
        <h1>Create landing pages in minutes.</h1>
        <p class="lead">Describe your vision and let the multi-tool assistant design, code, and preview instantly.</p>
        <div class="actions">
          <button class="btn btn--primary">Get started</button>
          <button class="btn btn--ghost">Watch demo</button>
        </div>
      </section>
    `,
    css: `
      .hero {
        padding: clamp(3rem, 8vw, 5rem) clamp(1.5rem, 6vw, 4rem);
        display: grid;
        gap: 1.5rem;
        background: radial-gradient(circle at top, rgba(64,224,208,0.15), transparent), #010b16;
        color: white;
      }
      .hero h1 { font-size: clamp(2rem, 4vw, 3rem); }
      .hero .lead { color: rgba(255,255,255,0.75); max-width: 48ch; }
      .hero .actions { display: flex; flex-wrap: wrap; gap: 1rem; }
      .btn { border: none; padding: 0.85rem 1.5rem; border-radius: 999px; font-weight: 600; }
      .btn--primary { background: #40e0d0; color: #021b2b; }
      .btn--ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; }
    `,
    accessibilityNotes: ['Contrast ratio 7.5:1', 'Buttons have accessible labels'],
  },
  {
    id: 'feature-grid',
    name: 'Feature Grid',
    category: 'features',
    html: `
      <section class="feature-grid">
        <header>
          <p class="eyebrow">Capabilities</p>
          <h2>Tools that collaborate in real time</h2>
        </header>
        <div class="cards">
          <article>
            <h3>Graphics Studio</h3>
            <p>Layered editing, history, and exports that sync to the preview panel.</p>
            <span>Learn more →</span>
          </article>
          <article>
            <h3>Web Designer</h3>
            <p>WCAG-aware layouts, responsive breakpoints, and framework exports.</p>
            <span>Learn more →</span>
          </article>
          <article>
            <h3>Code IDE</h3>
            <p>Sandboxed execution with AI linting and inline chat prompts.</p>
            <span>Learn more →</span>
          </article>
        </div>
      </section>
    `,
    css: `
      .feature-grid { padding: clamp(2rem, 6vw, 4rem); background: white; color: #021b2b; }
      .feature-grid header { max-width: 640px; margin-bottom: 2rem; }
      .feature-grid .cards { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      .feature-grid article { padding: 1.5rem; border-radius: 1.25rem; border: 1px solid rgba(2,27,43,0.08); box-shadow: 0 15px 55px rgba(2,27,43,0.07); }
      .feature-grid h3 { margin-bottom: 0.75rem; }
      .feature-grid span { display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 600; color: #0077b6; }
    `,
    accessibilityNotes: ['Cards use semantic article tags', 'Headers follow h2/h3 hierarchy'],
  },
]
