![](resources/splotch-256.png)

# splotch, the child of [Inky](https://github.com/inkle/inky)

**Inky** is an editor for [ink](http://www.inklestudios.com/ink), inkle's markup language for writing interactive narrative in games, as used in [80 Days](http://www.inklestudios.com/80days). It's an IDE (integrated development environment), because it gives you a single app that lets you play in the editor as you write, and fix any bugs in your code.

**splotch** is the version I made while working on our first indie game, Radio Arctica, because I missed some features. Here’s what’s new:

## Advanced Production Syntax Highlighting
- TODO & DEBUG Comments: // TODO: comments are highlighted in neon yellow and // DEBUG comments in pastel pink to ensure action items never get lost.
- Choice Speakers: All-caps speaker tags inside choices (e.g. * [HUMAN]) are distinctly highlighted in purple.
- Production Tags: Visually distinguishes different types of # tags using specific colours (e.g., Speakers, Protected Voice-line IDs, Text/Presentation Effects, and - Narrative/Visual Effects).

## Enhanced Editor Navigation
- Go To Knot: You can right-click any divert target (-> knot_name) and instantly jump to its declaration.
- Local Text Highlights: Right-click to apply local, persistent yellow highlights to text you want to revisit. These highlights are saved to your local machine and are never committed to your .ink files, keeping your Git history clean.
- Test This Knot: Right-click anywhere inside a knot to instantly reset the preview pane and start testing your script from that exact point.

## Voice & Performance Tracking
- Show Performed Lines: A new editor toggle (off by default) that adds a subtle grey background to any dialogue line containing a voice-line ID (# id:XXXX). This gives you an instant, birds-eye view of which lines have already been voiced or performed in your script.

I might be adding some more as I go, so stay tuned.

## Download splotch:
[For Mac, Windows and Linux] (https://github.com/billecart/splotch/releases/)


