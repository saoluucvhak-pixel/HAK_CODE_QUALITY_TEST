"use strict";
const {scan}=require("./analyzer");
const {gate}=require("./quality-gate");
const {review}=require("./github-pr-review");
const {deduplicate}=require("./agent-findings");
function accept(root,checks={syntax:"NOT_RUN",unit:"NOT_RUN"},policy={}) {
 const report=scan(root);
 const quality=gate(report,checks,policy);
 const prReview=review(report,{minSeverity:policy.minSeverity||"high"});
 const findings=deduplicate(report.findings);
 return {schemaVersion:1,status:quality.status,summary:report.summary,quality,prReview,findings,generatedAt:new Date().toISOString()};
}
module.exports={accept};
