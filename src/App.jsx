import { useState, useMemo, useEffect, useRef } from 'react'
import { useData, useManifest, CHANNEL_LABELS, CHANNEL_META } from './useData.js'
import ViewExecutiveSummary from './views/ExecutiveSummary.jsx'
import ViewOverview from './views/Overview.jsx'
import ViewOpportunity from './views/OpportunityView.jsx'
import ViewWhatWorks from './views/WhatWorks.jsx'
import ViewCampaigns from './views/CampaignsV2.jsx'
import ViewCommunity from './views/CommunityV2.jsx'
import ViewAllPosts from './views/AllPosts.jsx'
import React from 'react'

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080C14; --s1: #0D1320; --s2: #111827; --s3: #1A2235;
    --bd: #1E2D45; --bd2: #2E4060;
    --tp: #F8FAFC; --ts: #CBD5E1; --tm: #94A3B8;
    --ac: #38BDF8; --ac2: #0EA5E9;
    --ok: #34D399; --wn: #FBBF24; --no: #F43F5E;
    --r: 8px; --r2: 12px;
    --font: 'Syne', sans-serif; --mono: 'JetBrains Mono', monospace;
  }
  html, body, #root { height:100%; background:var(--bg); color:var(--tp); font-family:var(--font); font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased; }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:var(--s1); }
  ::-webkit-scrollbar-thumb { background:var(--bd2); border-radius:3px; }
  button { cursor:pointer; border:none; background:none; font-family:var(--font); }
  input, select { font-family:var(--font); }
  a { color:inherit; text-decoration:none; }
  .card { background:var(--s2); border:1px solid var(--bd); border-radius:var(--r2); padding:20px; }
  .mono { font-family:var(--mono); }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .fade-in { animation: fadeIn 0.25s ease both; }
  @keyframes slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
  @keyframes spin { to { transform:rotate(360deg); } }
`

const VIEWS = [
  { id:'executive', label:'Executive Summary', icon:'◈' },
  { id:'overview',  label:'Channel Performance', icon:'◎' },
  { id:'whatworks', label:'What Works',        icon:'⊞' },
  { id:'campaigns', label:'Campaigns',         icon:'⌦' },
  { id:'community', label:'Community',         icon:'⬡' },
  { id:'opportunity', label:'Opportunities',  icon:'⊕' },
  { id:'posts',     label:'All Posts',         icon:'≡' },
]

class ViewErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={error:null}}
  static getDerivedStateFromError(e){return{error:e}}
  componentDidCatch(e,i){console.error('View crashed:',e,i)}
  render(){
    if(this.state.error) return(
      <div style={{padding:32,color:'var(--no)',fontFamily:'var(--mono)',fontSize:14}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>This view crashed.</div>
        <div style={{color:'var(--tm)',marginBottom:12}}>{String(this.state.error)}</div>
        <button onClick={()=>this.setState({error:null})} style={{padding:'6px 14px',borderRadius:6,border:'1px solid var(--bd)',background:'var(--s3)',color:'var(--ts)'}}>Retry</button>
      </div>)
    return this.props.children
  }
}

const PRESETS=[
  {label:'7d',days:7},{label:'14d',days:14},{label:'30d',days:30},{label:'90d',days:90},
  {label:'180d',days:180},{label:'360d',days:360},
  {label:'2026',year:2026},{label:'2025',year:2025},{label:'2024',year:2024},
  {label:'All',all:true},
]
function presetToRange(p){
  if(p.all)return{start:null,end:null}
  if(p.year)return{start:new Date(`${p.year}-01-01`),end:new Date(`${p.year}-12-31`)}
  const e=new Date(),s=new Date();s.setDate(s.getDate()-p.days);return{start:s,end:e}
}
const ALL_CHANNELS=Object.keys(CHANNEL_LABELS)

export default function App(){
  // ── Manifest (list of all competitors) ─────────────────────────────────────
  const { loading: manifestLoading, error: manifestError, manifest } = useManifest()
  const [activeSlug, setActiveSlug] = useState(null)

  // Set default competitor once manifest loads
  useEffect(() => {
    if (manifest?.competitors?.length && !activeSlug) {
      setActiveSlug(manifest.competitors[0].slug)
    }
  }, [manifest, activeSlug])

  const activeCompetitor = manifest?.competitors?.find(c => c.slug === activeSlug) ?? null

  // ── Per-competitor data ─────────────────────────────────────────────────────
  const { loading, error, data, aiSummary } = useData(activeSlug)

  // ── View / filter state ─────────────────────────────────────────────────────
  const[view,setView]=useState('executive')
  const[activePreset,setActivePreset]=useState('All')
  const[customStart,setCustomStart]=useState('')
  const[customEnd,setCustomEnd]=useState('')
  const[pickerOpen,setPickerOpen]=useState(false)
  const[activeChannels,setActiveChannels]=useState(new Set(ALL_CHANNELS))
  const[channelMode,setChannelMode]=useState('all')
  const[fbGroupTier,setFbGroupTier]=useState('ALL')
  const pickerRef=useRef(null)
  const[glossaryOpen,setGlossaryOpen]=useState(false)
  const[navOpts,setNavOpts]=useState({})

  useEffect(()=>{
    if(!pickerOpen)return
    const h=e=>{if(pickerRef.current&&!pickerRef.current.contains(e.target))setPickerOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)
  },[pickerOpen])

  // Reset view state when competitor changes
  useEffect(() => {
    setView('executive')
    setActivePreset('All')
    setCustomStart('')
    setCustomEnd('')
    setActiveChannels(new Set(ALL_CHANNELS))
    setChannelMode('all')
    setFbGroupTier('ALL')
    setNavOpts({})
  }, [activeSlug])

  const dateRange=useMemo(()=>{
    if(customStart||customEnd)return{start:customStart?new Date(customStart):null,end:customEnd?new Date(customEnd+'T23:59:59'):null}
    const p=PRESETS.find(p=>p.label===activePreset)??PRESETS.find(p=>p.all);return presetToRange(p)
  },[activePreset,customStart,customEnd])
  const isCustomActive=!!(customStart||customEnd)

  if(typeof document!=='undefined'&&!document.getElementById('jc-global')){
    const s=document.createElement('style');s.id='jc-global';s.textContent=GLOBAL_CSS;document.head.appendChild(s)
  }

  const filteredPosts=useMemo(()=>{
    if(!data)return[]
    return data.organicPosts.filter(p=>{
      if(!activeChannels.has(p.channel))return false
      if(dateRange.start&&p.date_obj&&p.date_obj<dateRange.start)return false
      if(dateRange.end&&p.date_obj&&p.date_obj>dateRange.end)return false
      if(p.channel==='fb_group'){
        const isEden=p.post_author_is_eden==='YES'
        const role=(p.post_author||'').toLowerCase()+(p.author_role||'').toLowerCase()
        if(fbGroupTier==='ALL')return true
        if(fbGroupTier==='EDEN')return isEden
        if(fbGroupTier==='MODERATOR')return !isEden&&role.match(/admin|moderator/)
        if(fbGroupTier==='COMMUNITY')return !isEden&&!role.match(/admin|moderator/)
        return true
      }
      if(p.post_author_is_eden!=='YES')return false
      return true
    })
  },[data,dateRange,activeChannels,fbGroupTier])

  function toggleChannel(ch){
    if(channelMode==='all'){setActiveChannels(new Set([ch]));setChannelMode('selected')}
    else{setActiveChannels(prev=>{const n=new Set(prev);if(n.has(ch)&&n.size===1){setChannelMode('all');return new Set(ALL_CHANNELS)};if(n.has(ch))n.delete(ch);else n.add(ch);return n})}
  }
  function resetChannels(){setActiveChannels(new Set(ALL_CHANNELS));setChannelMode('all')}

  // ── Loading / error states ──────────────────────────────────────────────────
  if(manifestLoading) return <LoadingScreen message="LOADING DASHBOARD..."/>
  if(manifestError)   return <ErrorScreen message={manifestError}/>

  if(!manifest?.competitors?.length) return (
    <ErrorScreen message="No competitors found. Run seed-eden.js then push to GitHub." />
  )

  const activeView=VIEWS.find(v=>v.id===view)
  const name = activeCompetitor?.name ?? activeSlug ?? '—'
  const lastUpdated = activeCompetitor?.lastUpdated
    ? new Date(activeCompetitor.lastUpdated).toISOString().slice(0,10)
    : null

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>

      {/* ── SIDEBAR ── */}
      <aside style={{width:210,flexShrink:0,background:'var(--s1)',borderRight:'1px solid var(--bd)',display:'flex',flexDirection:'column',padding:'20px 0'}}>

        {/* Brand */}
        <div style={{padding:'0 16px 16px',borderBottom:'1px solid var(--bd)'}}>
          <div style={{fontSize:11,letterSpacing:'0.14em',color:'var(--tm)',marginBottom:2,fontFamily:'var(--mono)'}}>JUSTCAPABLE</div>
          <div style={{fontSize:17,fontWeight:800,color:'var(--tp)'}}>CI Dashboard</div>
          <div style={{fontSize:11,color:'var(--tm)',marginTop:1,fontFamily:'var(--mono)'}}>Competitor Intelligence</div>
        </div>

        {/* Competitor selector */}
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)'}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:'var(--tm)',fontFamily:'var(--mono)',marginBottom:8}}>COMPETITORS</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {manifest.competitors.map(c => {
              const isActive = c.slug === activeSlug
              return (
                <button key={c.slug} onClick={() => setActiveSlug(c.slug)}
                  style={{
                    width:'100%',padding:'8px 10px',borderRadius:7,textAlign:'left',
                    background: isActive ? 'var(--ac2)18' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--ac2)' : 'var(--bd)'}`,
                    transition:'all 0.15s',
                  }}>
                  <div style={{fontSize:13,fontWeight:isActive?700:500,color:isActive?'var(--ac)':'var(--ts)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                  <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--tm)',marginTop:1}}>
                    {c.postCount ? `${c.postCount} posts` : 'no data'}
                    {c.lastUpdated && ` · ${new Date(c.lastUpdated).toISOString().slice(0,10)}`}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:'12px 0',overflow:'auto'}}>
          {VIEWS.map(v=>(
            <button key={v.id} onClick={()=>{setNavOpts({});setView(v.id)}}
              style={{width:'100%',padding:'9px 16px',display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:view===v.id?700:500,color:view===v.id?'var(--tp)':'var(--ts)',background:view===v.id?'var(--s3)':'transparent',borderLeft:`3px solid ${view===v.id?'var(--ac)':'transparent'}`,transition:'all 0.15s',textAlign:'left'}}>
              <span style={{fontSize:14,opacity:view===v.id?1:0.5}}>{v.icon}</span>{v.label}
            </button>
          ))}
        </nav>

        {/* Data counts */}
        {data && (
          <div style={{padding:'12px 16px',borderTop:'1px solid var(--bd)',fontSize:12}}>
            {[['Organic',data.organicPosts.length],['Community',data.communityPosts.length],['Paid ads',data.paidAds.length],['Curriculum',data.curriculum.length]].map(([l,c])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                <span style={{color:'var(--tm)'}}>{l}</span><span style={{fontFamily:'var(--mono)',color:'var(--ts)'}}>{c}</span>
              </div>
            ))}
            <button onClick={()=>setGlossaryOpen(true)} style={{marginTop:8,width:'100%',padding:'5px 0',borderRadius:5,background:'var(--s3)',border:'1px solid var(--bd)',color:'var(--tm)',fontSize:12,fontFamily:'var(--mono)',letterSpacing:'0.06em',transition:'border-color 0.12s,color 0.12s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--ac)';e.currentTarget.style.color='var(--ac)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bd)';e.currentTarget.style.color='var(--tm)'}}>? GLOSSARY</button>
          </div>
        )}
      </aside>

      {glossaryOpen&&<GlossaryPanel onClose={()=>setGlossaryOpen(false)}/>}

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Top bar with filters */}
        <header style={{borderBottom:'1px solid var(--bd)',background:'var(--s1)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',padding:'0 14px',gap:5,overflowX:'auto',height:42}}>
            <span style={{fontSize:11,fontWeight:700,color:'var(--tm)',fontFamily:'var(--mono)',letterSpacing:'0.08em',whiteSpace:'nowrap',flexShrink:0}}>{name.toUpperCase()} · {activeView?.label?.toUpperCase()}</span>
            <div style={{width:1,height:14,background:'var(--bd)',flexShrink:0,margin:'0 2px'}}/>
            {PRESETS.map(p=>{const a=!isCustomActive&&activePreset===p.label;return(
              <button key={p.label} onClick={()=>{setActivePreset(p.label);setCustomStart('');setCustomEnd('');setPickerOpen(false)}}
                style={{padding:'3px 7px',borderRadius:4,fontSize:11,fontWeight:600,flexShrink:0,fontFamily:'var(--mono)',background:a?'var(--ac2)':'var(--s3)',color:a?'#fff':'var(--ts)',border:`1px solid ${a?'var(--ac2)':'var(--bd)'}`,transition:'all 0.12s'}}>{p.label}</button>)})}
            <div style={{position:'relative',flexShrink:0}} ref={pickerRef}>
              <button onClick={()=>setPickerOpen(o=>!o)} style={{padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:600,flexShrink:0,fontFamily:'var(--mono)',display:'flex',alignItems:'center',gap:4,background:isCustomActive?'#FBBF2422':'var(--s3)',color:isCustomActive?'var(--wn)':'var(--tm)',border:`1px solid ${isCustomActive?'#FBBF2455':'var(--bd)'}`,transition:'all 0.12s'}}>📅 {isCustomActive?`${customStart||'…'} → ${customEnd||'…'}`:'Custom'}</button>
              {pickerOpen&&(
                <div style={{position:'absolute',left:0,top:'calc(100% + 6px)',zIndex:500,background:'var(--s1)',border:'1px solid var(--bd2)',borderRadius:10,padding:'16px 18px',minWidth:280,boxShadow:'0 8px 32px #00000099'}}>
                  <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--tm)',letterSpacing:'0.08em',marginBottom:12}}>CUSTOM DATE RANGE</div>
                  <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12}}>
                    <div style={{flex:1}}><div style={{fontSize:10,color:'var(--tm)',fontFamily:'var(--mono)',marginBottom:4}}>FROM</div><input type="date" value={customStart} onChange={e=>{setCustomStart(e.target.value);setActivePreset('')}} style={{width:'100%',padding:'6px 8px',borderRadius:6,background:'var(--s3)',border:'1px solid var(--bd2)',color:'var(--tp)',fontSize:12,fontFamily:'var(--mono)',colorScheme:'dark'}}/></div>
                    <div style={{color:'var(--tm)',marginTop:14}}>→</div>
                    <div style={{flex:1}}><div style={{fontSize:10,color:'var(--tm)',fontFamily:'var(--mono)',marginBottom:4}}>TO</div><input type="date" value={customEnd} onChange={e=>{setCustomEnd(e.target.value);setActivePreset('')}} style={{width:'100%',padding:'6px 8px',borderRadius:6,background:'var(--s3)',border:'1px solid var(--bd2)',color:'var(--tp)',fontSize:12,fontFamily:'var(--mono)',colorScheme:'dark'}}/></div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{setCustomStart('');setCustomEnd('');setActivePreset('All');setPickerOpen(false)}} style={{flex:1,padding:'6px',borderRadius:6,fontSize:12,fontFamily:'var(--mono)',background:'var(--s3)',color:'var(--tm)',border:'1px solid var(--bd)'}}>Clear</button>
                    <button onClick={()=>setPickerOpen(false)} style={{flex:1,padding:'6px',borderRadius:6,fontSize:12,fontFamily:'var(--mono)',background:'var(--ac2)',color:'#fff',border:'none',fontWeight:700}}>Apply</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{width:1,height:14,background:'var(--bd)',flexShrink:0,margin:'0 2px'}}/>
            <button onClick={resetChannels} style={{padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:700,flexShrink:0,fontFamily:'var(--mono)',background:channelMode==='all'?'var(--ac2)':'var(--s3)',color:channelMode==='all'?'#fff':'var(--tm)',border:`1px solid ${channelMode==='all'?'var(--ac2)':'var(--bd)'}`,transition:'all 0.12s'}}>ALL</button>
            {ALL_CHANNELS.map(ch=>{const m=CHANNEL_META[ch],a=activeChannels.has(ch),d=channelMode==='selected'&&!a;return(
              <button key={ch} onClick={()=>toggleChannel(ch)} style={{padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:700,flexShrink:0,fontFamily:'var(--mono)',background:a&&channelMode==='selected'?m.color+'25':'var(--s3)',color:a&&channelMode==='selected'?m.color:d?'var(--bd2)':'var(--tm)',border:`1px solid ${a&&channelMode==='selected'?m.color+'66':'var(--bd)'}`,opacity:d?0.35:1,transition:'all 0.12s'}}>{CHANNEL_LABELS[ch].toUpperCase()}</button>)})}
            {(channelMode==='all'||activeChannels.has('fb_group'))&&(<>
              <div style={{width:1,height:14,background:'var(--bd)',flexShrink:0,margin:'0 2px'}}/>
              {[['ALL','ALL'],['EDEN','EDEN'],['MOD','MODERATOR'],['COM','COMMUNITY']].map(([l,k])=>{const a=fbGroupTier===k,c=CHANNEL_META.fb_group.color;return(
                <button key={k} onClick={()=>setFbGroupTier(p=>p===k&&k!=='ALL'?'ALL':k)} style={{padding:'3px 7px',borderRadius:4,fontSize:10,fontWeight:700,flexShrink:0,fontFamily:'var(--mono)',background:a?c+'22':'transparent',color:a?c:'var(--tm)',border:`1px solid ${a?c+'55':'var(--bd)'}`,transition:'all 0.12s',opacity:fbGroupTier!=='ALL'&&!a?0.4:1}}>FB:{l}</button>)})}
            </>)}
            <div style={{flex:1,minWidth:8}}/>
            {data && <span style={{fontSize:11,fontFamily:'var(--mono)',color:isCustomActive?'var(--wn)':'var(--tm)',whiteSpace:'nowrap',flexShrink:0}}>{filteredPosts.length} posts</span>}
          </div>
        </header>

        {/* ── Content area ── */}
        <main style={{flex:1,overflow:'auto',padding:'20px 24px'}}>
          {loading && <LoadingScreen message={`LOADING ${(activeCompetitor?.name ?? activeSlug ?? '').toUpperCase()}...`} />}
          {!loading && error && <ErrorScreen message={error} />}
          {!loading && !error && data && (
            <ViewErrorBoundary key={view + activeSlug}>
              {view==='executive'&&<ViewExecutiveSummary posts={filteredPosts} allPosts={data.organicPosts??[]} paidAds={data.paidAds??[]} competitor={activeCompetitor} aiSummary={aiSummary} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}} filterLabel={isCustomActive?`${customStart||'…'} → ${customEnd||'…'}`:activePreset}/>}
              {view==='opportunity'&&<ViewOpportunity posts={filteredPosts} allPosts={data.organicPosts??[]} competitor={activeCompetitor} aiSummary={aiSummary} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}}/>}
              {view==='overview' &&<ViewOverview posts={filteredPosts} allPosts={data.organicPosts??[]} competitor={activeCompetitor} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}}/>}
              {view==='whatworks'&&<ViewWhatWorks posts={filteredPosts} competitor={activeCompetitor} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}} initialDimension={navOpts.dimension} initialValue={navOpts.value}/>}
              {view==='campaigns'&&<ViewCampaigns posts={filteredPosts} paidAds={data.paidAds??[]} competitor={activeCompetitor} aiSummary={aiSummary} initialCampaignId={navOpts.campaignId} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}}/>}
              {view==='community'&&<ViewCommunity data={data} competitor={activeCompetitor} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}}/>}
              {view==='posts'    &&<ViewAllPosts posts={filteredPosts} competitor={activeCompetitor} initialChannel={navOpts.channelKey} onNavigate={(v,o)=>{setNavOpts(o||{});setView(v)}}/>}
            </ViewErrorBoundary>
          )}
        </main>
      </div>
    </div>
  )
}

function LoadingScreen({message='LOADING...'}){
  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
      <div style={{width:32,height:32,border:'3px solid var(--bd)',borderTopColor:'var(--ac)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <div style={{fontFamily:'var(--mono)',fontSize:14,color:'var(--tm)',letterSpacing:'0.08em'}}>{message}</div>
    </div>
  )
}

function ErrorScreen({message}){
  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:40}}>
      <div style={{fontSize:24}}>⚠</div>
      <div style={{fontWeight:700,color:'var(--no)'}}>Load failed</div>
      <div style={{fontFamily:'var(--mono)',fontSize:14,color:'var(--tm)',textAlign:'center',maxWidth:480}}>{message}</div>
    </div>
  )
}

function GlossaryPanel({ onClose }) {
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'#00000066',zIndex:100}}/>
      <div style={{position:'fixed',right:0,top:0,bottom:0,width:480,background:'var(--s1)',borderLeft:'1px solid var(--bd)',zIndex:101,overflow:'auto',padding:28,animation:'slideIn 0.2s ease'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:'var(--tp)'}}>Glossary</div>
          <button onClick={onClose} style={{color:'var(--tm)',fontSize:20}}>✕</button>
        </div>
        <div style={{fontSize:13,color:'var(--ts)',lineHeight:1.7}}>
          Click the <strong style={{color:'var(--ac)'}}>?</strong> button on any label in the What Works tab to see a plain-English explanation of that hook type, CTA method, or intent — including how it's typically used and what it produces.
        </div>
      </div>
    </>
  )
}
