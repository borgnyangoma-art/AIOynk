import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import type { ComponentProps } from 'react'

import PreviewPanel from '../preview/PreviewPanel'
import toolReducer, { setCurrentTool, updateToolContext } from '../../store/slices/toolSlice'

const createStore = () => configureStore({ reducer: { tool: toolReducer } })

type PreviewPanelProps = ComponentProps<typeof PreviewPanel>

const renderPanel = (store = createStore(), props?: Partial<PreviewPanelProps>) =>
  render(
    <Provider store={store}>
      <PreviewPanel isOpen onClose={() => {}} autoRefreshInitial={false} {...props} />
    </Provider>
  )

describe('PreviewPanel', () => {
  it('does not render when closed', () => {
    const store = createStore()
    const { queryByTestId } = render(
      <Provider store={store}>
        <PreviewPanel isOpen={false} onClose={() => {}} autoRefreshInitial={false} />
      </Provider>
    )

    expect(queryByTestId('preview-panel')).toBeNull()
  })

  it('shows placeholder when no tool selected', () => {
    renderPanel()
    expect(screen.getByTestId('preview-empty')).toBeInTheDocument()
  })

  it('renders graphics preview when tool context exists', () => {
    const store = createStore()
    const graphicsTool = store.getState().tool.tools.find((tool) => tool.id === 'graphics')!
    store.dispatch(setCurrentTool(graphicsTool))
    store.dispatch(updateToolContext({ toolId: 'graphics', context: { canvasData: 'mock' } }))

    renderPanel(store)

    expect(screen.getByTestId('preview-graphics')).toBeInTheDocument()
  })
})
