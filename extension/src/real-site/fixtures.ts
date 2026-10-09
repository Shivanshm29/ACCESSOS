/**
 * ACCESSOS Real-Site DOM Fixtures (Phase 14)
 * Accurate, hermetic DOM fixtures modeled on the 10 allowlisted real public websites.
 * Enables deterministic, repeatable, offline validation without third-party network flakiness.
 */

export const REAL_SITE_FIXTURES: Record<string, string> = {
  // Category A: Static Informational Page (Wikipedia)
  'site-a-wikipedia': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Web accessibility - Wikipedia</title></head>
    <body>
      <nav id="mw-navigation" role="navigation" aria-label="Site navigation">
        <h2>Navigation</h2>
        <ul><li><a href="#main-content">Jump to content</a></li><li><a href="/wiki/Main_Page">Main page</a></li></ul>
      </nav>
      <main id="main-content" role="main">
        <h1 id="firstHeading">Web accessibility</h1>
        <p>Web accessibility is the inclusive practice of ensuring there are no barriers that prevent interaction with websites by people with physical disabilities, situational disabilities, and socio-economic restrictions on bandwidth and speed.</p>
        <section id="toc" role="region" aria-label="Table of contents">
          <h2>Contents</h2>
          <ul>
            <li><a href="#universal-access">1 Universal access</a></li>
            <li><a href="#guidelines">2 Guidelines and standards</a></li>
          </ul>
        </section>
        <section id="universal-access">
          <h2>Universal access</h2>
          <p>When sites are correctly designed, developed and edited, more users have equal access to information and functionality.</p>
          <p>The needs that Web accessibility aims to address include visual impairments, hearing impairments, motor skills limitations, and cognitive and neurological conditions.</p>
        </section>
        <section id="guidelines">
          <h2>Guidelines and standards</h2>
          <p>The World Wide Web Consortium (W3C) coordinates the Web Accessibility Initiative (WAI), which develops technical guidelines.</p>
        </section>
      </main>
    </body>
    </html>
  `,

  // Category B: Public Documentation/Help Page (MDN Web Docs)
  'site-b-mdn-docs': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>HTML forms guide - MDN Web Docs</title></head>
    <body>
      <header role="banner">
        <nav aria-label="Breadcrumbs">
          <ol>
            <li><a href="/en-US/docs/Web">Web technologies</a></li>
            <li><a href="/en-US/docs/Learn">Learn web development</a></li>
            <li><span aria-current="page">HTML forms guide</span></li>
          </ol>
        </nav>
        <form role="search" id="mdn-search">
          <label for="search-input">Search MDN</label>
          <input type="search" id="search-input" placeholder="Search documentation...">
          <button type="button" id="search-btn">Search</button>
        </form>
      </header>
      <main id="content" role="main">
        <h1>HTML forms guide</h1>
        <p>HTML Forms are one of the main points of interaction between a user and a website or application.</p>
        <h2>Form controls</h2>
        <p>Forms allow users to enter data, which is generally sent to a web server for processing and storage.</p>
        <pre><code>&lt;form action="/my-handling-form-page" method="post"&gt;
  &lt;div&gt;
    &lt;label for="name"&gt;Name:&lt;/label&gt;
    &lt;input type="text" id="name" name="user_name"&gt;
  &lt;/div&gt;
&lt;/form&gt;</code></pre>
        <h2>Accessibility considerations</h2>
        <p>Always use explicit labels associated with form controls using the for attribute matching the input ID.</p>
      </main>
    </body>
    </html>
  `,

  // Category C: Public Article/Content Page (W3C WAI)
  'site-c-w3c-wai': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Introduction to Web Accessibility | Web Accessibility Initiative (WAI) | W3C</title></head>
    <body>
      <header role="banner" class="w3c-header">
        <a href="#main" class="skip-link">Skip to main content</a>
        <div class="site-title">W3C Web Accessibility Initiative (WAI)</div>
      </header>
      <nav role="navigation" aria-label="Main menu">
        <ul>
          <li><a href="/WAI/fundamentals/">Accessibility Fundamentals</a></li>
          <li><a href="/WAI/planning/">Planning &amp; Implementing</a></li>
        </ul>
      </nav>
      <main id="main" role="main">
        <h1>Introduction to Web Accessibility</h1>
        <div class="callout-box" role="note" aria-label="Key takeaway">
          <p><strong>Essential for some, useful for all:</strong> Web accessibility benefits people without disabilities as well as those with disabilities.</p>
        </div>
        <h2>What is Web Accessibility</h2>
        <p>Web accessibility means that websites, tools, and technologies are designed and developed so that people with disabilities can use them. More specifically, people can perceive, understand, navigate, and interact with the Web.</p>
        <h2>Why Accessibility is Important</h2>
        <p>The Web is an increasingly important resource in many aspects of life: education, employment, government, commerce, health care, recreation, and more.</p>
      </main>
    </body>
    </html>
  `,

  // Category D: Public Search Interface (Internet Archive)
  'site-d-archive-search': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Internet Archive Search</title></head>
    <body>
      <main role="main">
        <h1>Search the Internet Archive</h1>
        <form id="archive-search-form" role="search">
          <div class="search-bar">
            <label for="query-input">Search terms</label>
            <input type="text" id="query-input" name="q" placeholder="Search metadata, texts, audio, video..." required>
            <button type="button" id="submit-search-btn">Search</button>
          </div>
          <fieldset class="filters-section">
            <legend>Filter by Media Type</legend>
            <label><input type="checkbox" id="filter-texts" name="mediatype" value="texts" checked> Texts</label>
            <label><input type="checkbox" id="filter-audio" name="mediatype" value="audio"> Audio</label>
            <label><input type="checkbox" id="filter-video" name="mediatype" value="video"> Video</label>
          </fieldset>
          <div class="sort-section">
            <label for="sort-select">Sort by</label>
            <select id="sort-select" name="sort">
              <option value="relevance">Relevance</option>
              <option value="views">Views</option>
              <option value="date">Date</option>
            </select>
          </div>
        </form>
        <section id="search-results" aria-label="Search results">
          <h2>Results</h2>
          <p>Showing public domain items matching your criteria.</p>
        </section>
      </main>
    </body>
    </html>
  `,

  // Category E: Public Form with No Real Submission (W3C WAI Accessible Form Example)
  'site-e-w3c-form': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Accessible Form Example - W3C WAI Tutorials</title></head>
    <body>
      <main role="main">
        <h1>Accessible Form Example</h1>
        <p>This is a demonstration accessible form that does not perform real-world transactions.</p>
        <form id="contact-form" action="/mock-endpoint" method="post">
          <fieldset>
            <legend>Your Contact Information</legend>
            <div class="form-group">
              <label for="full-name">Full Name <span class="required" aria-hidden="true">*</span></label>
              <input type="text" id="full-name" name="name" required aria-required="true" aria-describedby="name-hint">
              <span id="name-hint" class="hint">Enter your first and last name.</span>
            </div>
            <div class="form-group">
              <label for="email-address">Email Address <span class="required" aria-hidden="true">*</span></label>
              <input type="email" id="email-address" name="email" required aria-required="true">
            </div>
            <div class="form-group">
              <label for="inquiry-topic">Reason for Contact</label>
              <select id="inquiry-topic" name="topic">
                <option value="general">General Inquiry</option>
                <option value="feedback">Website Feedback</option>
                <option value="support">Technical Support</option>
              </select>
            </div>
            <div class="form-group">
              <label for="message-text">Message</label>
              <textarea id="message-text" name="message" rows="4"></textarea>
            </div>
          </fieldset>
          <div class="form-actions">
            <button type="submit" id="submit-contact-btn">Send Message</button>
            <button type="reset" id="reset-contact-btn">Clear</button>
          </div>
        </form>
      </main>
    </body>
    </html>
  `,

  // Category F: Public Multi-Section Form / Questionnaire (USAGov Public Feedback)
  'site-f-usagov-feedback': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Website Feedback - USA.gov</title></head>
    <body>
      <main role="main">
        <h1>Help Us Improve USA.gov</h1>
        <p>Please take a few moments to provide feedback on your experience today.</p>
        <form id="feedback-survey-form">
          <section id="section-experience" class="form-step">
            <h2>Step 1: Your Visit Experience</h2>
            <fieldset>
              <legend>Did you find what you were looking for today?</legend>
              <label><input type="radio" id="find-yes" name="found_info" value="yes"> Yes</label>
              <label><input type="radio" id="find-partially" name="found_info" value="partially"> Partially</label>
              <label><input type="radio" id="find-no" name="found_info" value="no"> No</label>
            </fieldset>
          </section>
          <section id="section-topics" class="form-step">
            <h2>Step 2: Topic of Interest</h2>
            <fieldset>
              <legend>What topic were you researching?</legend>
              <label><input type="checkbox" id="topic-benefits" name="topic" value="benefits"> Government Benefits</label>
              <label><input type="checkbox" id="topic-taxes" name="topic" value="taxes"> Taxes and Filing</label>
              <label><input type="checkbox" id="topic-travel" name="topic" value="travel"> Passports and Travel</label>
            </fieldset>
          </section>
          <section id="section-comments" class="form-step">
            <h2>Step 3: Additional Comments</h2>
            <label for="feedback-comments">How can we improve this page?</label>
            <textarea id="feedback-comments" name="comments" rows="3"></textarea>
          </section>
          <div class="step-nav">
            <button type="button" id="prev-step-btn" disabled>Back</button>
            <button type="button" id="next-step-btn">Continue</button>
          </div>
        </form>
      </main>
    </body>
    </html>
  `,

  // Category G: Public Government Guidance Page (GOV.UK Passport)
  'site-g-govuk-passport': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Apply online for a UK passport - GOV.UK</title></head>
    <body>
      <div class="govuk-header" role="banner">
        <span class="govuk-logo">GOV.UK</span>
      </div>
      <main id="content" role="main" class="govuk-main-wrapper">
        <h1 class="govuk-heading-xl">Apply online for a UK passport</h1>
        <p class="govuk-body-l">Use this service to apply for, renew, replace or update your UK passport.</p>
        <div class="govuk-inset-text">
          It costs &pound;88.50 for a standard adult passport when you apply online.
        </div>
        <h2>What you need before you start</h2>
        <p>To apply online you will need:</p>
        <ul id="document-requirements-list" class="govuk-list govuk-list--bullet">
          <li>a digital photo that meets passport requirements</li>
          <li>a credit or debit card for payment</li>
          <li>your current passport (if you have one)</li>
          <li>official birth certificate or adoption certificate</li>
          <li>proof of residency and citizenship status</li>
        </ul>
        <div class="govuk-step-nav">
          <h2>Steps to apply</h2>
          <ol>
            <li>Check eligibility and gathering documents</li>
            <li>Take a compliant digital photograph</li>
            <li>Complete the online application details</li>
            <li>Send supporting documents by post</li>
          </ol>
        </div>
        <div class="action-wrapper">
          <a href="https://example.gov.uk/start" role="button" id="start-now-btn" class="govuk-button">Start now</a>
        </div>
      </main>
    </body>
    </html>
  `,

  // Category H: Public Page with Tables/Data (US BLS Employment Table)
  'site-h-bls-data-table': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Employment Situation Summary Table - US Bureau of Labor Statistics</title></head>
    <body>
      <main role="main">
        <h1>Employment Status of the Civilian Population Summary</h1>
        <p>Numbers in thousands. Seasonally adjusted data from household survey.</p>
        <table id="bls-data-table" border="1">
          <caption>Table A-1. Employment status of the civilian population by sex and age</caption>
          <thead>
            <tr>
              <th scope="col" id="col-category">Employment Status</th>
              <th scope="col" id="col-jan">Jan 2026</th>
              <th scope="col" id="col-feb">Feb 2026</th>
              <th scope="col" id="col-mar">Mar 2026</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" id="row-civilian-pop">Civilian noninstitutional population</th>
              <td headers="col-jan row-civilian-pop">269,120</td>
              <td headers="col-feb row-civilian-pop">269,280</td>
              <td headers="col-mar row-civilian-pop">269,450</td>
            </tr>
            <tr>
              <th scope="row" id="row-labor-force">Civilian labor force</th>
              <td headers="col-jan row-labor-force">168,400</td>
              <td headers="col-feb row-labor-force">168,550</td>
              <td headers="col-mar row-labor-force">168,720</td>
            </tr>
            <tr>
              <th scope="row" id="row-employed">Employed</th>
              <td headers="col-jan row-employed">161,800</td>
              <td headers="col-feb row-employed">161,990</td>
              <td headers="col-mar row-employed">162,150</td>
            </tr>
            <tr>
              <th scope="row" id="row-unemployed">Unemployed</th>
              <td headers="col-jan row-unemployed">6,600</td>
              <td headers="col-feb row-unemployed">6,560</td>
              <td headers="col-mar row-unemployed">6,570</td>
            </tr>
          </tbody>
        </table>
      </main>
    </body>
    </html>
  `,

  // Category I: Public Page with Modal/Dialog Interaction (W3C ARIA Dialog)
  'site-i-w3c-modal-dialog': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Modal Dialog Pattern Example - W3C ARIA APG</title></head>
    <body>
      <main id="main-content" role="main">
        <h1>Modal Dialog Pattern Demonstration</h1>
        <p>This example demonstrates an accessible modal dialog according to the ARIA Authoring Practices Guide.</p>
        <button type="button" id="open-dialog-btn" aria-haspopup="dialog">Add New Contact</button>
        <div id="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="dialog-overlay" hidden>
          <div class="dialog-content">
            <h2 id="dialog-title">Add Contact Details</h2>
            <p id="dialog-desc">Provide the name and phone number of the contact.</p>
            <div class="dialog-body">
              <label for="contact-name-input">Contact Name</label>
              <input type="text" id="contact-name-input" name="contact_name">
              <label for="contact-phone-input">Phone Number</label>
              <input type="tel" id="contact-phone-input" name="contact_phone">
            </div>
            <div class="dialog-actions">
              <button type="button" id="save-contact-btn">Save Contact</button>
              <button type="button" id="close-dialog-btn">Cancel</button>
            </div>
          </div>
        </div>
      </main>
    </body>
    </html>
  `,

  // Category J: Public Page with Dynamically Rendered Content (W3C ARIA Tabs)
  'site-j-w3c-tabs-pattern': `
    <!DOCTYPE html>
    <html lang="en">
    <head><title>Tabs Pattern Example - W3C ARIA APG</title></head>
    <body>
      <main role="main">
        <h1>Dynamic Tabs Interface Demonstration</h1>
        <p>Accessible tabbed component where selecting a tab displays its associated panel dynamically.</p>
        <div class="tabs-container">
          <div role="tablist" aria-label="Feature Documentation">
            <button role="tab" id="tab-overview" aria-selected="true" aria-controls="panel-overview" tabindex="0">Overview</button>
            <button role="tab" id="tab-features" aria-selected="false" aria-controls="panel-features" tabindex="-1">Features</button>
            <button role="tab" id="tab-specs" aria-selected="false" aria-controls="panel-specs" tabindex="-1">Specifications</button>
          </div>
          <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
            <h2>System Overview</h2>
            <p>ACCESSOS provides assistive intelligence and deterministic verification for web accessibility.</p>
          </div>
          <div id="panel-features" role="tabpanel" aria-labelledby="tab-features" tabindex="0" hidden>
            <h2>Core Features</h2>
            <p>Guided navigation, plain-language explanations, and safe interaction controls.</p>
          </div>
          <div id="panel-specs" role="tabpanel" aria-labelledby="tab-specs" tabindex="0" hidden>
            <h2>Technical Specifications</h2>
            <p>Compliant with Manifest V3 and zero-surveillance local processing architecture.</p>
          </div>
        </div>
      </main>
    </body>
    </html>
  `,
};

/**
 * Retrieves the HTML string for a specified site ID.
 */
export function getSiteFixtureHtml(siteId: string): string {
  return REAL_SITE_FIXTURES[siteId] || '';
}
