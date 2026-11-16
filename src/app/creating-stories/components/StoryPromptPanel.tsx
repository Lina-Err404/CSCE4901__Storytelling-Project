"use client"
import { useId, useState } from "react"
import { Type, SpellCheck, Lightbulb, BookOpen } from "lucide-react"
import { PanelFrame, PointedBanner } from "./StoryDecorations"

const bookmarks = [
  { color: "red", title: "Text Boxes", label: "Text", icon: Type },
  { color: "green", title: "Grammar Help", label: "Grammar", icon: SpellCheck },
  { color: "blue", title: "Writing Suggestions", label: "Ideas", icon: Lightbulb },
  { color: "gold", title: "Vocab Sheet", label: "Vocab", icon: BookOpen },
] as const

export default function StoryPromptPanel({ prompt }: { prompt: string }) {
  const [selected, setSelected] = useState<(typeof bookmarks)[number] | null>(null)
  const contentId = useId()
  const headingId = useId()
  const toolHeadingId = useId()
  const SelectedIcon = selected?.icon
  return <aside className="story-prompt-panel" aria-label="Writing tools and prompt" data-tool-open={Boolean(selected)}>
    <div className="story-bookmarks" role="group" aria-label="Writing tools">
      {bookmarks.map((tool) => <button key={tool.color} type="button" className={`story-bookmark story-bookmark-${tool.color}`}
        aria-label={tool.title} aria-controls={contentId} aria-expanded={selected === tool}
        aria-pressed={selected === tool} title={tool.title}
        onClick={() => setSelected((current) => current === tool ? null : tool)}>
        <svg className="story-bookmark-ribbon" viewBox="0 0 156 84" preserveAspectRatio="none" aria-hidden="true"><path d="M1 2H154V7L122 42 154 77V82H1Z" /></svg>
        <span className="story-bookmark-content" aria-hidden="true">
          <tool.icon className="story-bookmark-icon" />
          <span className="story-bookmark-label">{tool.label}</span>
        </span>
      </button>)}
    </div>
    <PanelFrame />
    <PointedBanner compact className="story-prompt-heading">
      <h1 id={headingId}>Prompt</h1>
    </PointedBanner>
    <div className="story-panel-sections">
      <div className="story-prompt-border" role="region" aria-labelledby={headingId}>
        <div className="story-prompt-text" tabIndex={0} aria-label="Writing prompt">{prompt}</div>
      </div>
      <div className="story-prompt-border story-tool-section" id={contentId} role="region" aria-labelledby={toolHeadingId} hidden={!selected}>
        <div className="story-prompt-text story-tool-content" tabIndex={0} aria-label={selected ? `${selected.title} content` : undefined} aria-live="polite">
          <div className="story-tool-empty">
            {SelectedIcon && <SelectedIcon className="story-tool-icon" aria-hidden="true" />}
            <h2 id={toolHeadingId}>{selected?.title}</h2>
            {selected && <p>This tool is coming soon.</p>}
          </div>
        </div>
      </div>
    </div>
  </aside>
}
