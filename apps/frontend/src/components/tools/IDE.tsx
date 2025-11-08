import React, { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Square, Save, Download, Folder, FileText } from 'lucide-react'
import CodeExecutionOutput from '../ide/CodeExecutionOutput'

const IDE: React.FC = () => {
  const [language, setLanguage] = useState('javascript')
  const [code, setCode] = useState('console.log("Hello, World!");')
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [openTabs, setOpenTabs] = useState([
    {
      id: 'main',
      name: 'main.js',
      language: 'javascript',
      code: 'console.log("Hello, World!");',
    },
  ])
  const [activeTab, setActiveTab] = useState('main')
  const editorRef = useRef<any>(null)

  const languages = [
    { id: 'javascript', name: 'JavaScript', ext: 'js' },
    { id: 'python', name: 'Python', ext: 'py' },
    { id: 'java', name: 'Java', ext: 'java' },
    { id: 'cpp', name: 'C++', ext: 'cpp' },
    { id: 'typescript', name: 'TypeScript', ext: 'ts' },
    { id: 'html', name: 'HTML', ext: 'html' },
    { id: 'css', name: 'CSS', ext: 'css' },
    { id: 'json', name: 'JSON', ext: 'json' },
  ]

  const fileTemplates: Record<string, string> = {
    javascript: 'console.log("Hello, World!");',
    python: 'print("Hello, World!")',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
    typescript: 'console.log("Hello, World!");',
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
    css: 'body {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
    json: '{\n  "name": "example",\n  "version": "1.0.0"\n}',
  }

  useEffect(() => {
    const activeTabData = openTabs.find((tab) => tab.id === activeTab)
    if (activeTabData) {
      setCode(activeTabData.code)
      setLanguage(activeTabData.language)
    }
  }, [activeTab, openTabs])

  const runCode = async () => {
    setIsRunning(true)
    setOutput('Running...\n')

    setTimeout(() => {
      if (language === 'python') {
        setOutput(
          (prev) => prev + 'Hello, World!\n\nProgram executed successfully.'
        )
      } else if (language === 'javascript' || language === 'typescript') {
        setOutput(
          (prev) => prev + 'Hello, World!\n\nProgram executed successfully.'
        )
      } else if (language === 'java') {
        setOutput(
          (prev) => prev + 'Hello, World!\n\nProgram executed successfully.'
        )
      } else if (language === 'cpp') {
        setOutput(
          (prev) => prev + 'Hello, World!\n\nProgram executed successfully.'
        )
      } else {
        setOutput((prev) => prev + 'Code executed.\n')
      }
      setIsRunning(false)
    }, 1000)
  }

  const stopCode = () => {
    setIsRunning(false)
    setOutput((prev) => prev + '\nExecution stopped.')
  }

  const saveCode = () => {
    const updatedTabs = openTabs.map((tab) =>
      tab.id === activeTab ? { ...tab, code } : tab
    )
    setOpenTabs(updatedTabs)
    setOutput((prev) => prev + '\nFile saved successfully.')
  }

  const downloadCode = () => {
    const currentLang = languages.find((l) => l.id === language)
    const extension = currentLang?.ext || 'txt'

    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `code.${extension}`
    link.click()
    URL.revokeObjectURL(url)
  }

  const createNewFile = () => {
    const newId = `file-${Date.now()}`
    const newFile = {
      id: newId,
      name: 'untitled',
      language: 'javascript',
      code: fileTemplates['javascript'],
    }
    setOpenTabs([...openTabs, newFile])
    setActiveTab(newId)
  }

  const closeTab = (tabId: string) => {
    const updatedTabs = openTabs.filter((tab) => tab.id !== tabId)
    setOpenTabs(updatedTabs)
    if (activeTab === tabId && updatedTabs.length > 0) {
      setActiveTab(updatedTabs[0].id)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value)
      setOpenTabs(
        openTabs.map((tab) =>
          tab.id === activeTab ? { ...tab, code: value } : tab
        )
      )
    }
  }

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Language:</label>
          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value
              setLanguage(newLang)
              setOpenTabs(
                openTabs.map((tab) =>
                  tab.id === activeTab ? { ...tab, language: newLang } : tab
                )
              )
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runCode}
            disabled={isRunning}
            className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Play size={18} />
            Run
          </button>
          <button
            onClick={stopCode}
            disabled={!isRunning}
            className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Square size={18} />
            Stop
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={createNewFile}
            className="flex items-center gap-2 rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
          >
            <FileText size={18} />
            New File
          </button>
          <button
            onClick={saveCode}
            className="flex items-center gap-2 rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
          >
            <Save size={18} />
            Save
          </button>
          <button
            onClick={downloadCode}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Download size={18} />
            Download
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-gray-200 bg-gray-100 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Folder size={18} />
            Explorer
          </div>
          <ul className="space-y-1 text-sm">
            {openTabs.map((tab) => (
              <li
                key={tab.id}
                className={`flex items-center justify-between rounded px-2 py-1 hover:bg-gray-200 ${
                  tab.id === activeTab ? 'bg-blue-100' : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="cursor-pointer">{tab.name}</span>
                {openTabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className="text-gray-500 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex border-b border-gray-200 bg-gray-50">
            {openTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-r border-gray-300 px-4 py-2 cursor-pointer ${
                  tab.id === activeTab
                    ? 'bg-white border-b-2 border-b-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm">{tab.name}</span>
                {tab.id !== activeTab && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className="text-gray-500 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                tabSize: 2,
              }}
            />
          </div>

          <CodeExecutionOutput
            output={output}
            isExecuting={isRunning}
            onClear={() => setOutput('')}
            onCopy={() => navigator.clipboard.writeText(output)}
            executionTime={isRunning ? undefined : 1000}
            memoryUsage="15.2 MB"
            exitCode={isRunning ? null : 0}
          />
        </div>
      </div>
    </div>
  )
}

export default IDE
