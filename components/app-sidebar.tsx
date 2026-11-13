"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Type, Letters, Lightbulb, ScrollText, BookImage } from "lucide-react"


// This is sidebar data (each icon and their respective objects)
const data = {

  //Writing Mode Buttons (navMain needs to be renamed and adjusted to their purpose in next sprint)
  navMain: [
    {
      title: "Text Boxes",
      url: "#",
      icon: (
        <Type
        />
      ),
      isActive: true,
    },
    {
      title: "Grammar Help",
      url: "#",
      icon: (
        <Letters
        />
      ),
      folder: "character",
    },
    {
      title: "Writing Suggestions",
      url: "#",
      icon: (
        <Lightbulb
        />
      ),
      folder: "props",
    },
    {
      title: "Vocab Sheet",
      url: "#",
      icon: (
        <ScrollText
        />
      ),
      folder: "background",
    },
    {
      title: "Border",
      url: "#",
      icon: (
        <BookImage
        />
      ),
      isActive: false,
    },
  ],
  
  /*

  Drawing Mode Buttons (will be worked on next sprint)

  navMain: [
    {
      title: "Shapes",
      url: "#",
      icon: (
        <Shapes
        />
      ),
      isActive: true,
    },
    {
      title: "Characters",
      url: "#",
      icon: (
        <UserGroup
        />
      ),
      folder: "character",
    },
    {
      title: "Props",
      url: "#",
      icon: (
        <PackageOpen
        />
      ),
      folder: "props",
    },
    {
      title: "Backgrounds",
      url: "#",
      icon: (
        <Image
        />
      ),
      folder: "background",
    },
    {
      title: "Draw!",
      url: "#",
      icon: (
        <Brush
        />
      ),
      isActive: false,
    },
  ], */
  
}

//Beyond this point is beyond my scope -Belen

type SidebarImage = { name: string; src: string }

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Tool selection is local; panel visibility belongs to SidebarProvider.
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])
  const [images, setImages] = React.useState<SidebarImage[]>([])
  const { open, setOpen } = useSidebar()
  const panelId = React.useId()
  const headingId = React.useId()

  React.useEffect(() => {
    if (!activeItem.folder) return
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
      className="overflow-hidden border-blue-200 *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-(--sidebar-width-icon)! shrink-0 border-r border-blue-200/20 bg-[#294889] bg-none"
      >
        <SidebarContent className="py-3">
          <SidebarGroup className="w-full">
            <SidebarGroupContent className="px-1.5">
              <SidebarMenu className="items-center gap-2" aria-label="Story tools">
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      aria-label={item.title}
                      aria-expanded={open && activeItem.title === item.title}
                      aria-controls={open ? panelId : undefined}
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onPress={() => {
                        setOpen(!(open && activeItem.title === item.title))
                        if (activeItem !== item) setImages([])
                        setActiveItem(item)
                      }}
                      isActive={open && activeItem.title === item.title}
                      className="size-11 justify-center rounded-xl border border-transparent p-0 text-blue-100 transition-colors duration-150 hover:bg-white/10 hover:text-white active:bg-white/15 data-[active=true]:border-blue-200/40 data-[active=true]:bg-blue-100 data-[active=true]:text-[#294889] data-[active=true]:hover:bg-blue-50 data-[active=true]:hover:text-[#294889] aria-expanded:hover:bg-blue-50 aria-expanded:hover:text-[#294889] data-[active=false]:bg-transparent data-[active=false]:text-blue-100 data-[active=false]:hover:bg-white/10 data-[active=false]:hover:text-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#294889] group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0! motion-reduce:transition-none [&_svg]:size-6"
                    >
                      {item.icon}
                      <span className="sr-only">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar
        collapsible="none"
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
        className="hidden min-w-0 flex-1 bg-blue-50 bg-none text-[#294889] md:flex hidden:hidden"
      >
        <SidebarHeader className="gap-1 border-b border-blue-100 bg-white px-5 py-5">
          <p className="text-xs font-medium tracking-wide text-blue-700">Story tools</p>
          <h2 id={headingId} className="text-lg font-semibold leading-snug">
            {activeItem.title}
          </h2>
        </SidebarHeader>
        <SidebarContent className="p-4">
          <SidebarGroup>
            {/*grid-cols-2 and image mapping should only be for drawing mode and border button (this will be worked in next sprint) */}
            <SidebarGroupContent className="grid grid-cols-2 gap-3">
              {images.length === 0 && (
                <div className="col-span-2 rounded-2xl border border-blue-100 bg-white px-4 py-6 text-center">
                  <div aria-hidden="true" className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 [&_svg]:size-6">
                    {activeItem.icon}
                  </div>
                  <p className="text-sm font-medium">{activeItem.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    This tool is coming soon.
                  </p>
                </div>
              )}
              {images.map((img) => (
                <button
                  key={img.src}
                  type="button"
                  onClick={() => {
                    // do something with the image, e.g. add it to your canvas
                  }}
                  className="aspect-square overflow-hidden rounded-xl border border-blue-100 bg-white transition-colors hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none"
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
