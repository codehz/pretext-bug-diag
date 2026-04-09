import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
  walkRichInlineLineRanges,
  type RichInlineItem,
} from '@chenglou/pretext/rich-inline'
import './App.css'

const SAMPLE_TEXT = `Pretext 的 inline rich 模式会把 “引号里的重点” 变成粗体，把 (括号里的补充说明) 变成斜体，并保持普通文本自然换行。你还可以继续输入 “新的强调片段” 或 (旁注)。`

const ALT_TEXT = `这里演示普通文本、 “强调内容” 、英文 mixed content，以及 (轻量注释) 如何一起参与 inline 布局。未闭合的标记会保持原样，比如 “这一段不会被解析。`

const FONT_FAMILY =
  '"Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

const MIN_PREVIEW_WIDTH = 220
const MAX_PREVIEW_WIDTH = 760
const MIN_FONT_SIZE = 16
const MAX_FONT_SIZE = 30

type InlineStyleName = 'body' | 'bold' | 'italic'

type ParsedToken = {
  style: InlineStyleName
  text: string
}

type RenderedFragment = {
  className: string
  gapBefore: number
  text: string
}

type RenderedLine = {
  fragments: RenderedFragment[]
  width: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseBoundedNumber(
  value: string,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return clamp(Math.round(parsed), min, max)
}

function pushToken(tokens: ParsedToken[], style: InlineStyleName, text: string) {
  if (text.length === 0) {
    return
  }

  const previous = tokens[tokens.length - 1]
  if (previous?.style === style) {
    previous.text += text
    return
  }

  tokens.push({ style, text })
}

function parseInlineRichText(text: string): ParsedToken[] {
  const tokens: ParsedToken[] = []
  let plainBuffer = ''
  let index = 0

  while (index < text.length) {
    const char = text[index]
    let closingMarker = ''
    let style: InlineStyleName | null = null

    if (char === '“') {
      closingMarker = '”'
      style = 'bold'
    } else if (char === '(') {
      closingMarker = ')'
      style = 'italic'
    }

    if (style === null) {
      plainBuffer += char
      index += 1
      continue
    }

    const closingIndex = text.indexOf(closingMarker, index + 1)
    if (closingIndex === -1) {
      plainBuffer += char
      index += 1
      continue
    }

    const content = text.slice(index + 1, closingIndex)
    if (content.length === 0) {
      plainBuffer += text.slice(index, closingIndex + 1)
      index = closingIndex + 1
      continue
    }

    pushToken(tokens, 'body', plainBuffer)
    plainBuffer = ''
    pushToken(tokens, style, text.slice(index, closingIndex + 1))
    index = closingIndex + 1
  }

  pushToken(tokens, 'body', plainBuffer)
  return tokens
}

function countStyledTokens(tokens: ParsedToken[]) {
  return tokens.filter(token => token.style !== 'body').length
}

function App() {
  const [text, setText] = useState(SAMPLE_TEXT)
  const deferredText = useDeferredValue(text)
  const [previewWidth, setPreviewWidth] = useState(460)
  const [fontSize, setFontSize] = useState(22)

  const lineHeight = Math.round(fontSize * 1.75)

  const textStyles = useMemo(
    () => ({
      body: {
        className: 'frag frag--body',
        font: `500 ${fontSize}px ${FONT_FAMILY}`,
      },
      bold: {
        className: 'frag frag--bold',
        font: `700 ${fontSize}px ${FONT_FAMILY}`,
      },
      italic: {
        className: 'frag frag--italic',
        font: `italic 500 ${fontSize}px ${FONT_FAMILY}`,
      },
    }),
    [fontSize],
  )

  const parsedTokens = useMemo(
    () => parseInlineRichText(deferredText),
    [deferredText],
  )

  const previewData = useMemo(() => {
    const classNames: string[] = []
    const items: RichInlineItem[] = parsedTokens.map(token => {
      const config = textStyles[token.style]
      classNames.push(config.className)
      return {
        text: token.text,
        font: config.font,
      }
    })

    const prepared = prepareRichInline(items)
    const stats = measureRichInlineStats(prepared, previewWidth)
    const lines: RenderedLine[] = []

    walkRichInlineLineRanges(prepared, previewWidth, range => {
      const line = materializeRichInlineLineRange(prepared, range)
      lines.push({
        width: line.width,
        fragments: line.fragments.map(fragment => ({
          className: classNames[fragment.itemIndex] ?? textStyles.body.className,
          gapBefore: fragment.gapBefore,
          text: fragment.text,
        })),
      })
    })

    return {
      lines,
      stats,
      styledTokenCount: countStyledTokens(parsedTokens),
    }
  }, [parsedTokens, previewWidth, textStyles])

  const previewBodyStyle: CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize,
    fontWeight: 500,
    lineHeight: `${lineHeight}px`,
    width: previewWidth,
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">React + @chenglou/pretext/rich-inline</p>
        <h1>Inline Rich Text Demo</h1>
        <p className="hero-copy">
          Enter rule-based source text on the left, then preview how pretext's
          rich inline helpers split and lay it out on the right. This demo
          currently supports two rules: text inside `“”` becomes bold, and text
          inside `()` becomes italic.
        </p>
      </section>

      <div className="workspace">
        <section className="control-column">
          <article className="card">
            <div className="section-heading">
              <h2>Text Input</h2>
              <span className="badge">inline only</span>
            </div>

            <textarea
              className="text-editor"
              value={text}
              spellCheck={false}
              onChange={(event) => {
                setText(event.target.value)
              }}
            />

            <div className="button-row">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setText(SAMPLE_TEXT)
                  })
                }}
              >
                Sample A
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setText(ALT_TEXT)
                  })
                }}
              >
                Sample B
              </button>
            </div>

            <p className="hint">
              Inline rich mode handles whitespace collapsing and line wrapping
              like normal inline text.
              {deferredText !== text ? ' Reflowing…' : ''}
            </p>
          </article>

          <article className="card">
            <div className="section-heading">
              <h2>Rules & Controls</h2>
              <span className="badge warm">live preview</span>
            </div>

            <div className="rule-list">
              <p>
                <code>“emphasized text”</code> keeps the quotes and renders the
                full span in bold.
              </p>
              <p>
                <code>(side note)</code> keeps the parentheses and renders the
                full span in italic.
              </p>
              <p>Unclosed or empty markers are preserved as normal text.</p>
            </div>

            <div className="control-grid">
              <label className="control">
                <span>Preview Width</span>
                <input
                  type="range"
                  min={MIN_PREVIEW_WIDTH}
                  max={MAX_PREVIEW_WIDTH}
                  value={previewWidth}
                  onChange={(event) => {
                    setPreviewWidth(Number(event.target.value))
                  }}
                />
                <input
                  type="number"
                  min={MIN_PREVIEW_WIDTH}
                  max={MAX_PREVIEW_WIDTH}
                  value={previewWidth}
                  onChange={(event) => {
                    setPreviewWidth(
                      parseBoundedNumber(
                        event.target.value,
                        previewWidth,
                        MIN_PREVIEW_WIDTH,
                        MAX_PREVIEW_WIDTH,
                      ),
                    )
                  }}
                />
              </label>

              <label className="control">
                <span>Font Size</span>
                <input
                  type="range"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  value={fontSize}
                  onChange={(event) => {
                    setFontSize(Number(event.target.value))
                  }}
                />
                <input
                  type="number"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  value={fontSize}
                  onChange={(event) => {
                    setFontSize(
                      parseBoundedNumber(
                        event.target.value,
                        fontSize,
                        MIN_FONT_SIZE,
                        MAX_FONT_SIZE,
                      ),
                    )
                  }}
                />
              </label>
            </div>
          </article>

          <article className="card">
            <div className="section-heading">
              <h2>Layout Metrics</h2>
              <span className="badge cool">precomputed</span>
            </div>

            <div className="metric-grid">
              <div className="metric">
                <span>Preview Width</span>
                <strong>{previewWidth}px</strong>
              </div>
              <div className="metric">
                <span>Font Size</span>
                <strong>{fontSize}px</strong>
              </div>
              <div className="metric">
                <span>Line Count</span>
                <strong>{previewData.stats.lineCount}</strong>
              </div>
              <div className="metric">
                <span>Widest Line</span>
                <strong>{previewData.stats.maxLineWidth.toFixed(1)}px</strong>
              </div>
              <div className="metric">
                <span>Styled Segments</span>
                <strong>{previewData.styledTokenCount}</strong>
              </div>
              <div className="metric">
                <span>Total Segments</span>
                <strong>{parsedTokens.length}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="preview-column">
          <article className="card preview-card">
            <div className="section-heading">
              <div>
                <h2>Inline Rich Preview</h2>
                <p className="canvas-subtitle">
                  Each line comes from pretext's rich inline line range output.
                </p>
              </div>
              <span className="canvas-size">{previewWidth}px</span>
            </div>

            <div className="preview-frame">
              <div className="preview-scroller">
                <div className="preview-surface" style={previewBodyStyle}>
                  {previewData.lines.length === 0 ? (
                    <p className="empty-state">
                      Enter some text to see the inline rich preview here.
                    </p>
                  ) : (
                    previewData.lines.map((line, index) => (
                      <div
                        className="preview-line"
                        key={`${index}-${line.width}`}
                        style={{ minHeight: lineHeight }}
                      >
                        {line.fragments.map((fragment, fragmentIndex) => (
                          <span
                            className={fragment.className}
                            key={`${index}-${fragmentIndex}-${fragment.text}`}
                            style={{ marginLeft: fragment.gapBefore }}
                          >
                            {fragment.text}
                          </span>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="card">
            <div className="section-heading">
              <h2>Line-by-Line Fragments</h2>
              <span className="badge">materialized</span>
            </div>

            <div className="line-list">
              {previewData.lines.map((line, index) => (
                <div className="line-row line-row--rich" key={`${index}-${line.width}`}>
                  <span className="line-index">L{index + 1}</span>
                  <span className="line-width">{line.width.toFixed(1)}px</span>
                  <div className="line-fragments">
                    {line.fragments.map((fragment, fragmentIndex) => (
                      <span
                        className={fragment.className}
                        key={`${index}-${fragmentIndex}-${fragment.text}-list`}
                        style={{ marginLeft: fragment.gapBefore }}
                      >
                        {fragment.text}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App
