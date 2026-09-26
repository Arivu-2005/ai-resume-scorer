const fileInput=document.getElementById("fileInput"),dropZone=document.getElementById("dropZone"),analyzeBtn=document.getElementById("analyzeBtn"),uploadScreen=document.getElementById("uploadScreen"),loadingScreen=document.getElementById("loadingScreen"),errorScreen=document.getElementById("errorScreen"),resultsScreen=document.getElementById("resultsScreen"),filePreview=document.getElementById("filePreview"),fileName=document.getElementById("fileName"),removeFile=document.getElementById("removeFile"),retryBtn=document.getElementById("retryBtn"),resetBtn=document.getElementById("resetBtn");
let selectedFile=null,pdfjsLib=null;

async function loadPDFJS(){if(pdfjsLib)return pdfjsLib;pdfjsLib=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";return pdfjsLib}

fileInput.addEventListener("change",e=>{const f=e.target.files[0];if(f)selectFile(f)});
function selectFile(file){if(file.type!=="application/pdf"){showError("Please upload a PDF resume.");return}selectedFile=file;fileName.textContent=file.name;filePreview.classList.remove("hidden");analyzeBtn.disabled=false;hideError()}
removeFile.addEventListener("click",()=>{selectedFile=null;fileInput.value="";filePreview.classList.add("hidden");analyzeBtn.disabled=true});
dropZone.addEventListener("dragover",e=>{e.preventDefault();dropZone.classList.add("drag")});
dropZone.addEventListener("dragleave",()=>dropZone.classList.remove("drag"));
dropZone.addEventListener("drop",e=>{e.preventDefault();dropZone.classList.remove("drag");const f=e.dataTransfer.files[0];if(f)selectFile(f)});

analyzeBtn.addEventListener("click",analyzeResume);
async function analyzeResume(){
 if(!selectedFile)return;showLoading();
 try{
  updateLoadingStep(1);const text=await extractPDFText(selectedFile);
  if(!text||text.trim().length<50)throw new Error("Could not extract enough text from this PDF. Make sure the resume contains selectable text rather than only scanned images.");
  updateLoadingStep(2);await delay(300);updateLoadingStep(3);const analysis=analyzeResumeText(text);await delay(500);updateLoadingStep(4);await delay(500);displayResults(analysis,text);
 }catch(error){console.error(error);showError(error.message||"Unable to analyze the resume.")}
}
async function extractPDFText(file){
 const pdfjs=await loadPDFJS(),buffer=await file.arrayBuffer(),pdf=await pdfjs.getDocument({data:buffer}).promise;let fullText="";
 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){const page=await pdf.getPage(pageNumber),content=await page.getTextContent();fullText+=content.items.map(item=>item.str).join(" ")+"\n\n"}
 return cleanText(fullText)
}
function cleanText(text){return text.replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n\s*\n\s*\n/g,"\n\n").trim()}

function analyzeResumeText(text){
 const lower=text.toLowerCase(),sections=detectSections(lower),keywords=detectKeywords(lower),contact=detectContactInformation(text),metrics=detectMetrics(text),projectCount=detectProjectCount(lower),bulletCount=detectBullets(text);
 const scores=calculateScores({text,sections,keywords,contact,metrics,projectCount,bulletCount});
 return {name:detectName(text),role:detectRole(text),verdict:generateVerdict(scores.overall),overall:scores.overall,breakdown:{ATS:scores.ats,Clarity:scores.clarity,Skills:scores.skills,Impact:scores.impact,Formatting:scores.formatting},sections,keywords,strengths:generateStrengths({text,sections,keywords,contact,metrics,projectCount,bulletCount}),improvements:generateImprovements({text,sections,keywords,contact,metrics,projectCount,bulletCount}),contact,metrics,projectCount,bulletCount}
}
function detectSections(text){
 const map={Summary:["professional summary","summary","profile","objective"],Education:["education","academic background"],Experience:["experience","work experience","employment"],Projects:["projects","project experience"],Skills:["skills","technical skills","relevant skills"],Certifications:["certification","certifications","courses","online courses"],Languages:["languages","languages known"],Achievements:["achievements","awards","honors"],Activities:["activities","leadership","volunteering"]},result={};
 for(const [section,aliases] of Object.entries(map))result[section]=aliases.some(a=>text.includes(a));return result
}
function detectKeywords(text){
 const groups={Frontend:["html","html5","css","css3","javascript","bootstrap","react","angular","vue","responsive","frontend","front-end","ui","user interface"],Backend:["node.js","nodejs","express","flask","django","api","rest"],Database:["mysql","mongodb","postgresql","sql","database"],Tools:["git","github","figma","vscode","visual studio code","postman"],Concepts:["debugging","testing","crud","object-oriented","oop","data structures","responsive web"]},found=[];
 for(const group of Object.values(groups))for(const keyword of group)if(text.includes(keyword))found.push(keyword);
 return [...new Set(found)]
}
function detectContactInformation(text){return{email:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi.test(text),phone:/(?:\+91[\s-]?)?[6-9]\d{9}/g.test(text),linkedin:/linkedin/i.test(text),github:/github/i.test(text),portfolio:/portfolio/i.test(text)||/vercel/i.test(text)||/netlify/i.test(text)}}
function detectMetrics(text){const patterns=[/\b\d+(?:\.\d+)?%/g,/\b\d+\+?\s*(?:users|customers|downloads|projects|clients)/gi,/\b\d+(?:\.\d+)?\s*(?:seconds|ms|minutes|hours)/gi,/\b\d+(?:\.\d+)?\/10\b/g],results=[];for(const p of patterns){const m=text.match(p);if(m)results.push(...m)}return[...new Set(results)]}
function detectProjectCount(text){const i=text.indexOf("projects");if(i===-1)return 0;const pt=text.substring(i),words=["project","platform","application","system","website","simulator"];let count=0;for(const w of words){const m=pt.match(new RegExp(`\\b${w}\\b`,"gi"));if(m)count+=m.length}return Math.min(Math.max(Math.round(count/2),0),8)}
function detectBullets(text){const m=text.match(/[•●▪◦]/g);return m?m.length:0}
function detectName(text){const lines=text.split("\n").map(x=>x.trim()).filter(Boolean);for(const line of lines.slice(0,8)){if(line.length>2&&line.length<60&&!line.includes("@")&&!/\d{7,}/.test(line)&&!/resume|curriculum|cv/i.test(line))return line}return"Resume Candidate"}
function detectRole(text){const roles=["frontend developer","front-end developer","web developer","software engineer","python developer","full stack developer","developer","software developer","intern"],lower=text.toLowerCase();for(const role of roles)if(lower.includes(role))return role.split(" ").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");return"Developer"}

function calculateScores(data){
 const {sections,keywords,contact,metrics,projectCount,bulletCount}=data,sectionCount=Object.values(sections).filter(Boolean).length;
 let ats=40+Math.min(sectionCount*5,30)+Math.min(keywords.length*1.5,15);if(contact.email)ats+=2;if(contact.phone)ats+=2;if(contact.linkedin)ats+=2;if(contact.github)ats+=2;ats=clamp(ats);
 let clarity=50;if(sections.Summary)clarity+=8;if(sections.Education)clarity+=8;if(sections.Experience)clarity+=8;if(sections.Projects)clarity+=8;if(bulletCount>=5)clarity+=8;clarity=clamp(clarity);
 let skills=35+Math.min(keywords.length*3,45)+(sections.Skills?12:0);skills=clamp(skills);
 let impact=45+(metrics.length?20:0)+(projectCount>=2?15:0)+(sections.Experience?10:0);impact=clamp(impact);
 let formatting=50+(sectionCount>=4?15:0)+(bulletCount>=5?15:0)+(textLengthHealthy(data)?10:0);formatting=clamp(formatting);
 return{overall:Math.round((ats+clarity+skills+impact+formatting)/5),ats,clarity,skills,impact,formatting}
}
function textLengthHealthy(data){return data.text.length>=800&&data.text.length<=12000}
function generateStrengths(data){const s=[];if(data.contact.email)s.push("Professional email address detected.");if(data.contact.linkedin)s.push("LinkedIn profile is included.");if(data.contact.github)s.push("GitHub profile is included.");if(data.sections.Projects)s.push("Projects section provides evidence of practical work.");if(data.sections.Skills)s.push("Dedicated skills section improves ATS keyword discoverability.");if(data.sections.Experience)s.push("Professional experience is clearly represented.");if(data.keywords.length>=8)s.push("Resume contains a strong set of technical keywords.");if(data.metrics.length)s.push("Quantified information is present, which can strengthen project impact.");if(data.bulletCount>=5)s.push("Bullet-based descriptions improve recruiter scanability.");return(s.length?s:["Resume contains extractable text that can be evaluated by ATS software."]).slice(0,5)}
function generateImprovements(data){const i=[];if(!data.contact.linkedin)i.push("Add a clickable LinkedIn URL.");if(!data.contact.github)i.push("Add GitHub if you have relevant technical projects.");if(!data.contact.portfolio)i.push("Consider adding a portfolio link for frontend-focused applications.");if(!data.sections.Summary)i.push("Add a concise professional summary targeted to the role.");if(!data.sections.Experience)i.push("Add relevant internship or professional experience.");if(!data.sections.Projects)i.push("Add 2–3 strong projects with technologies and outcomes.");if(!data.sections.Skills)i.push("Add a dedicated technical skills section using job-relevant keywords.");if(!data.metrics.length)i.push("Where truthful, add measurable project results such as users, performance, accuracy, or deployment details.");if(data.keywords.length<8)i.push("Increase relevant technical keywords that genuinely match your target job.");if(data.bulletCount<5)i.push("Use concise bullet points for experience and project descriptions.");return i.slice(0,6)}
function generateVerdict(score){if(score>=85)return"Strong ATS foundation with clear technical evidence. Focus on tailoring keywords and measurable project outcomes for each job.";if(score>=70)return"Good resume foundation with relevant technical content. A few targeted improvements can make it more competitive for ATS screening.";if(score>=55)return"The resume contains useful experience and skills, but its ATS structure and evidence of impact can be strengthened.";return"The resume needs stronger ATS structure, clearer evidence of skills, and more targeted content before applying."}

function displayResults(data,text){uploadScreen.classList.add("hidden");loadingScreen.classList.add("hidden");errorScreen.classList.add("hidden");resultsScreen.classList.remove("hidden");document.getElementById("candidateName").textContent=data.name;document.getElementById("candidateRole").textContent=data.role;document.getElementById("verdictText").textContent=data.verdict;animateScore(data.overall);renderBreakdown(data.breakdown);renderKeywords(data.keywords);renderFeedback(data.strengths,data.improvements);renderSections(data.sections);document.getElementById("textPreview").textContent=text}
function animateScore(score){const circle=document.getElementById("scoreCircle"),number=document.getElementById("scoreNumber"),circumference=2*Math.PI*70;circle.style.strokeDasharray=circumference;circle.style.strokeDashoffset=circumference;circle.style.stroke=scoreColor(score);const start=performance.now();function frame(time){const p=Math.min((time-start)/1000,1),current=Math.round(p*score);number.textContent=current;circle.style.strokeDashoffset=circumference-(current/100)*circumference;if(p<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)}
function renderBreakdown(breakdown){const c=document.getElementById("breakdown");c.innerHTML="";Object.entries(breakdown).forEach(([label,value])=>{const row=document.createElement("div");row.className="bar-row";const color=scoreColor(value);row.innerHTML=`<span class="bar-label">${escapeHTML(label)}</span><div class="bar-track"><div class="bar-fill" style="background:${color}"></div></div><span class="bar-number" style="color:${color}">${value}</span>`;c.appendChild(row);requestAnimationFrame(()=>row.querySelector(".bar-fill").style.width=`${value}%`)})}
function renderKeywords(keywords){document.getElementById("keywordStats").innerHTML=`<div class="keyword-stats"><div class="keyword-stat"><strong>${keywords.length}</strong><span>Detected Keywords</span></div></div>`;const list=document.getElementById("keywordList");list.innerHTML="";keywords.forEach(k=>{const e=document.createElement("span");e.className="keyword";e.textContent=k;list.appendChild(e)})}
function renderFeedback(strengths,improvements){const a=document.getElementById("strengths"),b=document.getElementById("improvements");a.innerHTML="";b.innerHTML="";strengths.forEach(x=>{const li=document.createElement("li");li.textContent=x;a.appendChild(li)});improvements.forEach(x=>{const li=document.createElement("li");li.textContent=x;b.appendChild(li)})}
function renderSections(sections){const c=document.getElementById("sectionsAnalysis");c.innerHTML="";Object.entries(sections).forEach(([section,present])=>{const row=document.createElement("div");row.className="section-result";row.innerHTML=`<span>${escapeHTML(section)}</span><span class="section-status ${present?"present":"missing"}">${present?"✓ PRESENT":"✕ MISSING"}</span>`;c.appendChild(row)})}
function showLoading(){uploadScreen.classList.add("hidden");resultsScreen.classList.add("hidden");errorScreen.classList.add("hidden");loadingScreen.classList.remove("hidden")}
function updateLoadingStep(n){for(let i=1;i<=4;i++){const e=document.getElementById(`step${i}`);if(!e)continue;if(i<=n){e.textContent="✓ "+e.textContent.replace(/^.[ ]/,"");e.style.color="#2dd4a0"}}}
function showError(message){uploadScreen.classList.add("hidden");loadingScreen.classList.add("hidden");resultsScreen.classList.add("hidden");errorScreen.classList.remove("hidden");document.getElementById("errorMessage").textContent=message}
function hideError(){errorScreen.classList.add("hidden")}
function resetApplication(){selectedFile=null;fileInput.value="";filePreview.classList.add("hidden");analyzeBtn.disabled=true;resultsScreen.classList.add("hidden");loadingScreen.classList.add("hidden");errorScreen.classList.add("hidden");uploadScreen.classList.remove("hidden")}
retryBtn.addEventListener("click",resetApplication);resetBtn.addEventListener("click",resetApplication);
function scoreColor(score){return score>=75?"#2dd4a0":score>=50?"#c9a84c":"#ff6b6b"}
function clamp(v){return Math.max(0,Math.min(100,Math.round(v)))}
function delay(ms){return new Promise(r=>setTimeout(r,ms))}
function escapeHTML(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;") }