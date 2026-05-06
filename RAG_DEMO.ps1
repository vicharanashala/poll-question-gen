# ============================================================
# RAG PIPELINE DEMO SCRIPT
# ============================================================

# -- CONFIG ---------------------------------------------------
$Uri = "http://localhost:8000/api/rag/ingest-and-generate"
$RoomCode = "RAG_DEMO_$(Get-Date -Format 'HHmmss')"

# -- HELPERS --------------------------------------------------
function Write-Header($text) {
    $line = "=" * 60
    Write-Host "`n$line" -ForegroundColor Cyan
    Write-Host " $text" -ForegroundColor Cyan
    Write-Host "$line" -ForegroundColor Cyan
}

function Write-Section($text) {
    $pad = 52 - $text.Length
    if ($pad -lt 2) { $pad = 2 }
    $dashes = "-" * $pad
    Write-Host "`n-- $text $dashes" -ForegroundColor Yellow
}

function Write-Pass($text) { Write-Host " [PASS] $text" -ForegroundColor Green }
function Write-Fail($text) { Write-Host " [FAIL] $text" -ForegroundColor Red }
function Write-Info($text) { Write-Host " [INFO] $text" -ForegroundColor DarkCyan }
function Write-Warn($text) { Write-Host " [WARN] $text" -ForegroundColor DarkYellow }

function Write-QuestionBox($q, $index) {
    $typeColor = switch ($q.questionType) {
        "SOL" { "Magenta" }
        "SML" { "Blue" }
        "NAT" { "DarkYellow" }
        "DES" { "Cyan" }
        default { "White" }
    }
    Write-Host "`n +-- Question $index " -ForegroundColor DarkGray -NoNewline
    Write-Host "[$($q.questionType)]" -ForegroundColor $typeColor -NoNewline
    Write-Host " -------------------------------------" -ForegroundColor DarkGray
    Write-Host " | Q: $($q.questionText)" -ForegroundColor White

    $opts = @($q.options)
    if ($opts.Count -gt 0) {
        Write-Host " |" -ForegroundColor DarkGray
        Write-Host " | Options:" -ForegroundColor DarkGray
        $letters = @("A","B","C","D","E")
        for ($i = 0; $i -lt $opts.Count; $i++) {
            $opt = $opts[$i]
            $letter = if ($i -lt $letters.Count) { $letters[$i] } else { "$($i+1)" }
            $isCorrect = ($opt.correct -eq $true -or "$($opt.correct)" -eq "True")
            if ($isCorrect) {
                Write-Host " | [$letter] $($opt.text) <-- CORRECT" -ForegroundColor Green
                if ($opt.explanation) {
                    Write-Host " |     Why: $($opt.explanation)" -ForegroundColor DarkGreen
                }
            } else {
                Write-Host " | [$letter] $($opt.text)" -ForegroundColor DarkGray
                if ($opt.explanation) {
                    Write-Host " |     Why: $($opt.explanation)" -ForegroundColor DarkGray
                }
            }
        }
    }

    if ($q.solution) {
        Write-Host " |" -ForegroundColor DarkGray
        $sol = if ($q.solution -is [string]) { $q.solution } else { $q.solution | ConvertTo-Json -Compress }
        Write-Host " | Solution: $sol" -ForegroundColor DarkCyan
    }

    Write-Host " |" -ForegroundColor DarkGray
    Write-Host " | Points: $($q.points)  Time: $($q.timeLimitSeconds)s  Grounded in: $($q.segmentId)" -ForegroundColor DarkGray
    Write-Host " +----------------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Diagnostics($transcript, $questions) {
    Write-Section "DIAGNOSTICS"

    $totalChars = $transcript.Length
    $uniqueChunks = $questions | ForEach-Object { $_.sourceChunks } | Where-Object { $_ } | Select-Object -Unique
    $chunkChars = ($uniqueChunks | Measure-Object -Property Length -Sum).Sum
    if (-not $chunkChars) { $chunkChars = 0 }
    $pct = if ($totalChars -gt 0) { [math]::Round(($chunkChars / $totalChars) * 100, 1) } else { 0 }
    $uniqueSegments = ($questions | Select-Object -ExpandProperty segmentId -Unique).Count
    $questionCount = $questions.Count

    Write-Host ""
    Write-Host "  Original transcript : $totalChars chars" -ForegroundColor White
    Write-Host "  Unique context used : $chunkChars chars ($pct% of original)" -ForegroundColor White
    Write-Host "  Questions generated : $questionCount" -ForegroundColor White
    Write-Host "  Distinct segments   : $uniqueSegments" -ForegroundColor White
    Write-Host ""

    if ($pct -eq 0) {
        Write-Fail "No context retrieved from ChromaDB."
    } elseif ($pct -lt 80) {
        Write-Pass "RAG filtered correctly -- sent $pct% of transcript to Ollama, not all of it."
    } else {
        Write-Warn "High retrieval ratio ($pct%). Retrieval may not be selective enough."
    }
}

# -- TRANSCRIPT -----------------------------------------------
$Transcript = @"
Topic 1: The mitochondria is a double-membrane-bound organelle found in most eukaryotic organisms. It generates most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy. The mitochondria has its own DNA that is separate from the cell nucleus.

Topic 2: A black hole is a region of spacetime where gravity is so strong that nothing, not even light, can escape from it. The boundary beyond which escape is impossible is called the event horizon. The theory of general relativity predicts that a sufficiently compact mass can deform spacetime to form a black hole.

Topic 3: The Roman Empire was the post-Republican period of ancient Rome. At its peak it spanned over 5 million square kilometres and had a population of around 70 million people across Europe, Northern Africa, and Western Asia.
"@

# -- TESTS ----------------------------------------------------
$Tests = @(
    @{
        Name        = "Test 1 -- SOL (Single correct answer)"
        Description = "1 SOL question, topK=1. Expects one question with 4 options, one correct."
        Payload     = @{ roomCode = $RoomCode; transcript = $Transcript; questionSpec = @{ SOL = 1 }; topK = 1 }
    },
    @{
        Name        = "Test 2 -- NAT (Numerical answer)"
        Description = "1 NAT question, topK=1. Should retrieve chunk with numbers/data."
        Payload     = @{ roomCode = $RoomCode; transcript = $Transcript; questionSpec = @{ NAT = 1 }; topK = 1 }
    },
    @{
        Name        = "Test 3 -- DES (Detailed explanation) with topK=2"
        Description = "1 DES question, topK=2. Retrieves 2 chunks -- tests multi-chunk context."
        Payload     = @{ roomCode = $RoomCode; transcript = $Transcript; questionSpec = @{ DES = 1 }; topK = 2 }
    },
    @{
        Name        = "Test 4 -- Multi-type: 2x SOL + 1x NAT"
        Description = "3 questions in one request. Tests that the pipeline iterates over questionSpec."
        Payload     = @{ roomCode = $RoomCode; transcript = $Transcript; questionSpec = @{ SOL = 2; NAT = 1 }; topK = 1 }
    }
)

# -- MAIN RUN -------------------------------------------------
Write-Header "RAG PIPELINE DEMO"
Write-Host "  Endpoint  : $Uri" -ForegroundColor DarkGray
Write-Host "  Room Code : $RoomCode" -ForegroundColor DarkGray
Write-Host "  Transcript: $($Transcript.Length) chars across 3 topics (Biology, Astronomy, History)" -ForegroundColor DarkGray

$globalPass = 0
$globalFail = 0

foreach ($test in $Tests) {
    Write-Header $test.Name
    Write-Host "  $($test.Description)" -ForegroundColor DarkGray

    $body = $test.Payload | ConvertTo-Json -Depth 5

    try {
        Write-Host "`n  Calling API..." -ForegroundColor DarkGray
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-RestMethod -Uri $Uri -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300
        $sw.Stop()
        $elapsed = [math]::Round($sw.Elapsed.TotalSeconds, 1)

        Write-Pass "Response received in ${elapsed}s"

        $questions = @($response.questions)

        if ($questions.Count -eq 0) {
            Write-Fail "API returned 0 questions."
            $globalFail++
            continue
        }

        Write-Pass "$($questions.Count) question(s) returned."
        $globalPass++

        Write-Section "QUESTIONS"
        for ($i = 0; $i -lt $questions.Count; $i++) {
            Write-QuestionBox $questions[$i] ($i + 1)
        }

        Write-Section "SOURCE CHUNKS"
        $uniqueChunks = $questions | ForEach-Object { $_.sourceChunks } | Where-Object { $_ } | Select-Object -Unique
        foreach ($chunk in $uniqueChunks) {
            $preview = if ($chunk.Length -gt 180) { $chunk.Substring(0, 180) + "..." } else { $chunk }
            Write-Host "  > $preview" -ForegroundColor DarkGray
            Write-Host ""
        }

        Write-Diagnostics $Transcript $questions

    } catch {
        Write-Fail "Request failed: $_"
        $globalFail++
    }

    Write-Host "`n  Waiting 5s before next test..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}

# -- FINAL SUMMARY --------------------------------------------
Write-Header "FINAL SUMMARY"
Write-Host "  Tests passed : $globalPass / $($Tests.Count)" -ForegroundColor $(if ($globalFail -eq 0) { "Green" } else { "Yellow" })
Write-Host "  Tests failed : $globalFail / $($Tests.Count)" -ForegroundColor $(if ($globalFail -gt 0) { "Red" } else { "DarkGray" })
Write-Host ""
if ($globalFail -eq 0) {
    Write-Pass "All tests passed. RAG pipeline is fully operational."
} else {
    Write-Warn "$globalFail test(s) failed. Check output above for details."
}
Write-Host ""
