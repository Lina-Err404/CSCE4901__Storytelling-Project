"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { InboxIcon, FileIcon, SendIcon, ArchiveXIcon, Trash2Icon, TerminalIcon } from "lucide-react"


// This is sample data
const data = {
  
  navMain: [
    {
      title: "Text Boxes",
      url: "#",
      icon: (
        <InboxIcon
        />
      ),
      isActive: true,
    },
    {
      title: "Characters",
      url: "#",
      icon: (
        <FileIcon
        />
      ),
      folder: "character",
    },
    {
      title: "Props",
      url: "#",
      icon: (
        <SendIcon
        />
      ),
      folder: "props",
    },
    {
      title: "Backgrounds",
      url: "#",
      icon: (
        <ArchiveXIcon
        />
      ),
      folder: "background",
    },
    {
      title: "Draw!",
      url: "#",
      icon: (
        <Trash2Icon
        />
      ),
      isActive: false,
    },
  ],
  
}

type SidebarImage = { name: string; src: string }

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Note: I'm using state to show active item.
  // IRL you should use the url/router.
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])
  const [images, setImages] = React.useState<SidebarImage[]>([])
  const { setOpen } = useSidebar()

React.useEffect(() => {
    if (!activeItem.folder) {
      setImages([])
      return
    }
    const controller = new AbortController()
    fetch(`/api/images/${activeItem.folder}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setImages)
      .catch((e) => {
        if (e.name !== "AbortError") setImages([])
      })
    return () => controller.abort()
  }, [activeItem])

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item)
                        setOpen(true)
                      }}
                      isActive={activeItem?.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          
        </SidebarFooter>
      </Sidebar>
      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
            <div className="text-base font-medium text-foreground">
              {activeItem?.title}
            </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent className="grid grid-cols-2 gap-2 p-4">
  {images.map((img) => (
    <button
      key={img.src}
      type="button"
      onClick={() => {
        // do something with the image, e.g. add it to your canvas
      }}
      className="aspect-square overflow-hidden rounded-md border bg-background hover:ring-2 hover:ring-sidebar-ring"
    >
      <img
        src={img.src}
        alt={img.name}
        loading="lazy"
        className="size-full object-contain p-1"
      />
    </button>
  ))}
</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
