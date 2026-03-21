import type { ReactNode } from 'react'

interface AppLayoutProps {
  children: ReactNode
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="h-full w-full relative">
      {children}
    </div>
  )
}

export default AppLayout
